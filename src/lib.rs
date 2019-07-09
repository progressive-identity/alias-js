mod archive;
mod jsfile;
mod jsreader;
mod utils;
mod wasm;

use crate::utils::io_error_to_js_error;
use std::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    wasm::init();
}

/*#[wasm_bindgen]
pub fn debug(jsfile: jsfile::JsFile) -> Result<(), JsValue> {
    let file = jsfile::File::new(jsfile);
    let file = io::BufWriter::with_capacity(16 * 1024 * 1024, file);
    let mut file = flate2::write::GzEncoder::new(file, flate2::Compression::best());
    let buf: [u8; 4] = [65, 65, 65, 65];
    file.write(&buf).unwrap();

    Ok(())
}*/
