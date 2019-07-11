mod anychain;
mod archive;
mod jsfile;
mod jsreader;
mod raw_writer;
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
pub fn debug(v: JsValue) -> anychain::Hash {
    anychain::hash(&(0 as u64)).into_value()
}
