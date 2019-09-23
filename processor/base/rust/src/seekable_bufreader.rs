use log::*;
use std::io::*;
use std::*;
use std::cmp::min;

pub struct SeekBufReader<R> {
    source: R,
    offset: usize,
    block_size: usize,
    block_id: Option<usize>,
    block: Vec<u8>,
    block_len: Option<usize>,
    size: usize,
}

impl<R> SeekBufReader<R>
where
    R: Read + Seek,
{
    pub fn with_capacity(block_size: usize, source: R) -> Self {
        let mut c = SeekBufReader {
            source: source,
            offset: 0,
            block_size: block_size,
            block: vec![0; block_size],
            block_len: None,
            block_id: None,
            size: 0,
        };

        c.size = c.source.seek(SeekFrom::End(0)).expect("cannot seek to end of file") as usize;
        c.source.seek(SeekFrom::Start(0)).expect("cannot seek to start of file");

        c
    }

    fn block_offset(&self, block_id: usize) -> u64 {
        (block_id * self.block_size) as u64
    }

    fn read_block(&mut self, block_id: usize, offset: usize, buf: &mut [u8]) -> Result<usize> {
        if offset + buf.len() >= self.block_size {
            panic!("offset + buffer size cannot be bigger than block size");
        }

        let fetch = match self.block_id {
            None => true,
            Some(cur_block_id) => cur_block_id != block_id,
        };

        if fetch {
            self.source.seek(SeekFrom::Start(self.block_offset(block_id)))?;
            //debug!("source read {} {} {}", self.block_size, self.block.len(), self.block.as_slice().len());
            let read_size = self.source.read(&mut self.block[0..self.block_size])?;

            self.block_id = Some(block_id);
            self.block_len = Some(read_size);
        }

        let len = min(buf.len(), self.block_len.unwrap() - offset);
        //debug!("copy from slice {} {}", offset, len);
        buf.copy_from_slice(&mut self.block[offset..offset+len]);
        Ok(len)
    }

    pub fn into_inner(mut self) -> R {
        self.source.seek(SeekFrom::Start(0)).expect("cannot seek to start of file");
        self.source
    }
}

impl<R> Read for SeekBufReader<R>
where
    R: Read + Seek,
{
    fn read(&mut self, out_buf: &mut [u8]) -> Result<usize> {
        //debug!("read {}", out_buf.len());

        let mut cursor: usize = 0;
        while cursor < out_buf.len() {
            let block_id = self.offset / self.block_size;
            let rel_offset = self.offset % self.block_size;
            let rel_size = self.block_size - rel_offset;

            let len = min(out_buf.len(), rel_size);
            //debug!("read block {} {} {} {}", block_id, rel_offset, cursor, len);
            let rel_buf = &mut out_buf[cursor..cursor + len];
            let read_size = self.read_block(block_id, rel_offset, rel_buf)?;

            if read_size == 0 {
                break;
            }

            self.offset = self.offset + read_size;
            cursor = cursor + read_size;
        }

        Ok(cursor)
    }
}

fn add_u64_to_i64(a: u64, b: i64) -> Option<u64> {
    if b >= 0 {
        a.checked_add(b as u64)
    } else {
        a.checked_sub((-b) as u64)
    }
}

impl<R> Seek for SeekBufReader<R>
where
    R: Read + Seek,
{
    fn seek(&mut self, pos: SeekFrom) -> Result<u64> {
        let new_offset = match pos {
            SeekFrom::Start(start_pos) => Some(start_pos),
            SeekFrom::End(end_pos) => add_u64_to_i64(self.size as u64, end_pos),
            SeekFrom::Current(rel_pos) => add_u64_to_i64(self.offset as u64, rel_pos),
        };

        match new_offset {
            Some(offset) => {
                self.offset = offset as usize;
                if self.offset > self.size {
                    self.offset = self.size;
                }

                //debug!("seek offset {}", self.offset);

                Ok(self.offset as u64)
            }
            None => Err(Error::new(
                ErrorKind::InvalidInput,
                "cannot seek a negative offset",
            )),
        }
    }
}
