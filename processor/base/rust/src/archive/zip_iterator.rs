use log::*;
use crate::archive::ArchiveIterator;
use borrow::Cow;
use std::io::{Read, Seek};
use std::path::Path;
use std::*;
use zip::read::*;

fn other(msg: &str) -> io::Error {
    io::Error::new(io::ErrorKind::Other, msg)
}

pub struct ZipIterator<'a, R: Read + Seek> {
    f: ZipArchive<R>,
    cur_f: Option<ZipFile<'a>>,
    current_idx: Option<usize>,
}

impl<'a, R> ZipIterator<'a, R>
where
    R: Read + Seek,
{
    pub fn new(r: R) -> Self {
        ZipIterator {
            f: ZipArchive::new(r).expect("zip new error"), // XXX TODO remove unwrap, propagate error
            current_idx: None,
        }
    }

    pub fn into_inner(self) -> ZipArchive<R> {
        self.f
    }

    fn next(&mut self) -> io::Result<Option<()>> {
        let current_idx = match self.current_idx {
            None => 0,
            Some(v) => v + 1,
        };
        self.current_idx = Some(current_idx);

        if current_idx >= self.f.len() {
            return Ok(None);
        }

        self.f.by_index(current_idx)?;

        return Ok(Some(()));
    }

    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        debug!("read open {}", buf.len());
        let mut f = self
            .f
            .by_index(self.current_idx.expect("next method not called"))
            .unwrap();
        debug!("read {}", buf.len());
        f.read(buf)
    }

    fn path(&mut self) -> io::Result<Cow<Path>> {
        let f = self
            .f
            .by_index(self.current_idx.expect("next method not called"))
            .unwrap();
        Ok(Cow::Owned(f.sanitized_name()))
    }

    fn size(&mut self) -> io::Result<u64> {
        let f = self
            .f
            .by_index(self.current_idx.expect("next method not called"))
            .unwrap();
        Ok(f.size())
    }
}

impl<'a, R> Read for ZipIterator<'a, R>
where
    R: Read + Seek,
{
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.read(buf)
    }
}

impl<'a, R> ArchiveIterator for ZipIterator<'a, R>
where
    R: Read + Seek,
{
    fn next(&mut self) -> io::Result<Option<()>> {
        self.next()
    }
    fn path(&mut self) -> io::Result<Cow<Path>> {
        self.path()
    }
    fn as_read_mut(&mut self) -> &mut Read {
        self
    }
    fn size(&mut self) -> io::Result<u64> {
        self.size()
    }
}
