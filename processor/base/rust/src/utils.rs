use std::io;
use wasm_bindgen::prelude::*;

pub fn io_error_to_js_error<T>(v: io::Result<T>) -> Result<T, JsValue> {
    match v {
        Ok(v) => Ok(v),
        Err(e) => Err(JsValue::from_str(format!("{}", e).as_str())),
    }
}
