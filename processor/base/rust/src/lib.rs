#![feature(bufreader_seek_relative)]

mod anychain;
mod archive;
mod jsfile;
mod jsreader;
mod probe_reader;
mod raw_writer;
mod seekable_bufreader;
mod utils;
mod wasm;

use std::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    wasm::init();
}

#[wasm_bindgen]
pub fn to_utf8(s: String) -> Vec<u8> {
    s.into_bytes()
}

#[wasm_bindgen]
pub fn from_utf8(b: Box<[u8]>) -> String {
    String::from_utf8_lossy(&b).to_string()
}

#[wasm_bindgen]
pub fn from_base64(s: String) -> Result<Box<[u8]>, JsValue> {
    match base64::decode_config(&s, base64::STANDARD_NO_PAD) {
        Ok(v) => Ok(v.into_boxed_slice()),
        Err(e) => Err(JsValue::from_str(&format!("{}", e))),
    }
}

#[wasm_bindgen]
pub fn to_base64(b: Box<[u8]>) -> String {
    base64::encode_config(&b, base64::STANDARD_NO_PAD)
}

/*#[wasm_bindgen]
pub fn debug(v: JsValue) -> anychain::Hash {
    anychain::hash(&(0 as u64)).into_value()
}*/
