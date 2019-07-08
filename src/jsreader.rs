use crate::utils::io_error_to_js_error;
use std::io::Read;
use wasm_bindgen::prelude::*;

pub unsafe fn new(r: &mut Read) -> JsReader {
    let static_r: &'static mut Read = std::mem::transmute(r);
    let ptr: *mut Read = static_r;

    JsReader { ptr: Some(ptr) }
}

#[wasm_bindgen]
pub struct JsReader {
    ptr: Option<*mut Read>,
}

#[wasm_bindgen]
impl JsReader {
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, JsValue> {
        let ptr = match self.ptr.as_mut() {
            Some(v) => v,
            None => {
                return Err(JsValue::from_str("dangling reader"));
            }
        };

        let r = unsafe { (**ptr).read(buf) };
        io_error_to_js_error(r)
    }

    pub fn drop(self) {
        drop(self)
    }
}

impl Drop for JsReader {
    fn drop(&mut self) {
        self.ptr.take();
    }
}
