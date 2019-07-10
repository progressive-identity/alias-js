use crate::archive::*;
use crate::jsfile::*;
use crate::utils::io_error_to_js_error;
use std::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
struct TarGzArchiveReader {
    js_file: Option<JsFile>,
    inner: Option<TarIterator<flate2::read::GzDecoder<io::BufReader<File>>>>,
    watchers: Watchers,
}

#[wasm_bindgen]
impl TarGzArchiveReader {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: JsFile) -> TarGzArchiveReader {
        let mut archive = TarGzArchiveReader {
            js_file: Some(js_file),
            inner: None,
            watchers: Watchers::new(),
        };

        archive.init_inner();

        archive
    }

    fn init_inner(&mut self) {
        let js_file = self.js_file.take().unwrap();
        let file = File::new(js_file);
        let file = io::BufReader::with_capacity(64 * 1024 * 1024, file);
        let file = flate2::read::GzDecoder::new(file);
        let inner = TarIterator::new(file);
        self.inner = Some(inner);
    }

    pub fn watch(&mut self, w: JsWatchers) {
        self.watchers.append(Watchers::from(w));
    }

    pub fn step(&mut self) -> Result<bool, JsValue> {
        use ArchiveIterator;
        loop {
            let archive_iter_mut: &mut ArchiveIterator = self.inner.as_mut().unwrap();
            let r = archive_iter_mut.step(&mut self.watchers);
            let r = io_error_to_js_error(r)?;

            // if data were processing, returns as so
            if r {
                return Ok(true);
            }
            // if EOF and no active watchers, stop
            else if !self.watchers.is_active() {
                return Ok(false);
            }

            // else, EOF with active watchers: rewind
            let js_file = self
                .inner
                .take()
                .unwrap()
                .into_inner()
                .into_inner()
                .into_inner()
                .finish();
            self.js_file = Some(js_file);
            self.init_inner();
        }
    }
}
