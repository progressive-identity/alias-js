use crate::utils::io_error_to_js_error;
use js_sys::JSON;
use std::io;
use std::io::Read;
use std::str;
use wasm_bindgen::prelude::*;

pub unsafe fn new(r: &mut Read, size: u64) -> JsReader {
    let static_r: &'static mut Read = std::mem::transmute(r);
    let ptr: *mut Read = static_r;

    JsReader {
        ptr: Some(ptr),
        size: size,
    }
}

#[wasm_bindgen]
pub struct JsReader {
    ptr: Option<*mut Read>,
    size: u64,
}

#[wasm_bindgen]
impl JsReader {
    fn as_mut_read(&mut self) -> Result<&mut Read, JsValue> {
        let ptr = match self.ptr.as_mut() {
            Some(v) => v,
            None => {
                return Err(JsValue::from_str("dangling reader"));
            }
        };

        Ok(unsafe { &mut (**ptr) })
    }

    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, JsValue> {
        io_error_to_js_error(self.as_mut_read()?.read(buf))
    }

    /// Read all content as an Uint8Array
    pub fn buf8(mut self) -> Result<Box<[u8]>, JsValue> {
        let mut buf = Vec::new();
        io_error_to_js_error(self.as_mut_read()?.read_to_end(&mut buf))?;
        Ok(buf.into_boxed_slice())
    }

    /// Read all content as a UTF-8 string
    pub fn text(mut self) -> Result<String, JsValue> {
        let mut buf = Vec::new();
        io_error_to_js_error(self.as_mut_read()?.read_to_end(&mut buf))?;
        match str::from_utf8(&buf) {
            Ok(v) => Ok(v.to_string()),
            Err(_) => Err(JsValue::from_str("unicode error")),
        }
    }

    /// Read all contenet as a JSON
    pub fn json(mut self) -> Result<JsValue, JsValue> {
        let mut buf = Vec::new();
        io_error_to_js_error(self.as_mut_read()?.read_to_end(&mut buf))?;
        match str::from_utf8(&buf) {
            Ok(v) => JSON::parse(v),
            Err(_) => Err(JsValue::from_str("unicode error")),
        }
    }

    pub fn drop(self) {
        drop(self)
    }

    pub fn size(&self) -> u64 {
        self.size
    }
}

impl Read for JsReader {
    fn read(&mut self, out_buf: &mut [u8]) -> io::Result<usize> {
        match self.as_mut_read() {
            Ok(r) => r.read(out_buf),
            Err(_) => Err(io::Error::new(io::ErrorKind::Other, "dangling jsreader")),
        }
    }
}

impl Drop for JsReader {
    fn drop(&mut self) {
        self.ptr.take();
    }
}
