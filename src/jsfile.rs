use conv::*;
use js_sys::Uint8Array;
use std::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

#[wasm_bindgen]
extern "C" {
    pub type JsFile;

    #[wasm_bindgen(method)]
    pub fn read(this: &JsFile, start: f64, end: f64) -> Uint8Array;

    #[wasm_bindgen(method)]
    pub fn size(this: &JsFile) -> JsValue;

    #[wasm_bindgen(method, catch)]
    pub fn write(this: &JsFile, buf: Box<[u8]>) -> Result<(), JsValue>;
}

pub struct File {
    inner: JsFile,
    offset: u64,
}

impl File {
    pub fn new(jsfile: JsFile) -> File {
        File {
            inner: jsfile,
            offset: 0,
        }
    }

    pub fn into_inner(self) -> JsFile {
        self.inner
    }

    pub fn size(&self) -> io::Result<u64> {
        match self.inner.size().as_f64() {
            None => Err(io::Error::new(io::ErrorKind::Other, "unknown size")),
            Some(size_f64) => Ok(size_f64.approx().expect("file's size is not castable")),
        }
    }
    /*
    pub fn stream_position(&self) -> std::io::Result<u64> {
        Ok(self.offset)
    }

    pub fn stream_len(&self) -> std::io::Result<u64> {
        self.size()
    }
    */
}

impl std::io::Read for File {
    fn read(&mut self, out_buf: &mut [u8]) -> std::io::Result<usize> {
        let start = f64::value_from(self.offset).expect("cannot cast start offset to f64");
        let end = f64::value_from(self.offset + out_buf.len() as u64)
            .expect("cannot cast end offset to f64");

        let buf = self.inner.read(start, end);
        // XXX TODO check buf is not null

        let buf_len = buf.length() as usize;

        if buf_len > 0 {
            buf.copy_to(&mut out_buf[0 as usize..buf_len]);
        }

        self.offset = self
            .offset
            .checked_add(buf_len as u64)
            .expect("u64 overflow");

        Ok(buf_len)
    }
}

impl std::io::Write for File {
    fn write(&mut self, in_buf: &[u8]) -> std::io::Result<usize> {
        let mut buf = Vec::with_capacity(in_buf.len());
        buf.extend_from_slice(in_buf);
        let buf = buf.into_boxed_slice();

        match self.inner.write(buf) {
            Ok(()) => Ok(in_buf.len()),
            Err(_) => Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "js writer failed",
            )),
        }
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn add_u64_to_i64(a: u64, b: i64) -> Option<u64> {
    if b >= 0 {
        a.checked_add(b as u64)
    } else {
        a.checked_sub((-b) as u64)
    }
}

impl std::io::Seek for File {
    fn seek(&mut self, pos: std::io::SeekFrom) -> std::io::Result<u64> {
        let new_offset = match pos {
            std::io::SeekFrom::Start(start_pos) => Some(start_pos),
            std::io::SeekFrom::End(end_pos) => add_u64_to_i64(self.size()?, end_pos),
            std::io::SeekFrom::Current(rel_pos) => add_u64_to_i64(self.offset, rel_pos),
        };

        match new_offset {
            Some(offset) => {
                self.offset = offset;
                if let Ok(size) = self.size() {
                    if self.offset > size {
                        self.offset = size;
                    }
                }
                Ok(self.offset)
            }
            None => Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "cannot seek a negative offset",
            )),
        }
    }
}

impl From<JsFile> for File {
    fn from(jsfile: JsFile) -> File {
        File::new(jsfile)
    }
}
