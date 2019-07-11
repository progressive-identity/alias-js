use crate::utils::io_error_to_js_error;
use std::*;
use wasm_bindgen::prelude::*;

use crate::anychain;
use crate::jsfile;
use crate::jsreader;

const FILE_MODE: u32 = 384; // 0600 in octal

#[wasm_bindgen]
struct TarGzArchiveWriter {
    inner:
        tar::Builder<flate2::write::GzEncoder<io::BufWriter<anychain::Blake2bWrite<jsfile::File>>>>,
}

#[wasm_bindgen]
impl TarGzArchiveWriter {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: jsfile::JsFile) -> TarGzArchiveWriter {
        let file = jsfile::File::new(js_file);
        let file = anychain::Blake2bWrite::new(file);
        let file = io::BufWriter::with_capacity(8 * 1024 * 1024, file);
        let file = flate2::write::GzEncoder::new(file, flate2::Compression::fast());
        let inner = tar::Builder::new(file);

        TarGzArchiveWriter { inner: inner }
    }

    pub fn add_entry_with_reader(
        &mut self,
        path: String,
        js_reader: jsreader::JsReader,
    ) -> Result<(), JsValue> {
        let mut header = tar::Header::new_gnu();
        header.set_mode(FILE_MODE);
        header.set_size(js_reader.size());
        io_error_to_js_error(self.inner.append_data(&mut header, path, js_reader))?;
        Ok(())
    }

    pub fn add_entry_with_string(&mut self, path: String, value: String) -> Result<(), JsValue> {
        let mut header = tar::Header::new_gnu();
        header.set_mode(FILE_MODE);
        let buf = value.as_bytes();
        header.set_size(buf.len() as u64);
        io_error_to_js_error(self.inner.append_data(&mut header, path, buf))?;
        Ok(())
    }

    pub fn finish(self) -> Result<anychain::Hash, JsValue> {
        io_error_to_js_error((move || {
            let (file, hash) = self.inner.into_inner()?.finish()?.into_inner()?.finish();
            file.finish();
            Ok(hash)
        })())
    }
}
