use crate::anychain;
use crate::jsfile;
use crate::utils::io_error_to_js_error;
use std::io;
use std::io::Write;
use wasm_bindgen::prelude::*;

const DEFAULT_BUFFER_CAPACITY: usize = 2 * 1024 * 1024;

#[wasm_bindgen]
pub struct RawWriter {
    inner: anychain::Blake2bWrite<io::BufWriter<jsfile::File>>,
}

#[wasm_bindgen]
impl RawWriter {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: jsfile::JsFile) -> RawWriter {
        let file = jsfile::File::new(js_file);
        let file = io::BufWriter::with_capacity(DEFAULT_BUFFER_CAPACITY, file);
        let file = anychain::Blake2bWrite::new(file);

        RawWriter { inner: file }
    }

    pub fn finish(self) -> Result<anychain::Hash, JsValue> {
        io_error_to_js_error((move || {
            let (file, hash) = self.inner.finish();
            file.into_inner()?.finish();
            Ok(hash)
        })())
    }

    pub fn write_string(&mut self, v: String) -> Result<(), JsValue> {
        io_error_to_js_error(self.write(v.as_bytes()))?;
        Ok(())
    }
}

impl Write for RawWriter {
    fn write(&mut self, in_buf: &[u8]) -> io::Result<usize> {
        self.inner.write(in_buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}
