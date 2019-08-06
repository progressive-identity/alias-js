use crate::archive::*;
use crate::jsfile::*;
use crate::probe_reader::*;
use crate::utils::io_error_to_js_error;
use std::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct TarGzArchiveReader {
    js_file: Option<JsFile>,
    inner: Option<TarIterator<flate2::read::GzDecoder<ProbeReader<io::BufReader<File>>>>>,
    watchers: Watchers,
    probe: ReadProbe,
    pass_count: u32,
}

#[wasm_bindgen]
impl TarGzArchiveReader {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: JsFile) -> TarGzArchiveReader {
        let mut archive = TarGzArchiveReader {
            js_file: Some(js_file),
            inner: None,
            watchers: Watchers::new(),
            probe: ReadProbe::new(),
            pass_count: 0,
        };

        archive.init_inner();

        archive
    }

    fn init_inner(&mut self) {
        let js_file = self.js_file.take().unwrap();
        let file = File::new(js_file);
        let file = io::BufReader::with_capacity(64 * 1024 * 1024, file);
        let file = ProbeReader::new(file, &self.probe);
        let file = flate2::read::GzDecoder::new(file);
        let inner = TarIterator::new(file);
        self.inner = Some(inner);
    }

    pub fn watch(&mut self, w: JsWatchers) {
        self.watchers.append(Watchers::from(w));
    }

    pub fn step(&mut self, max_iter: Option<usize>) -> Result<bool, JsValue> {
        use ArchiveIterator;
        loop {
            let archive_iter_mut: &mut ArchiveIterator = self.inner.as_mut().unwrap();
            let r = archive_iter_mut.step(&mut self.watchers, max_iter);
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
                .into_inner()
                .finish();
            self.js_file = Some(js_file);
            self.init_inner();
            self.pass_count = self.pass_count + 1;
        }
    }

    pub fn progress(&mut self) -> Option<f64> {
        use conv::*;

        let state = self.probe.get();

        let size = match state.size {
            Some(v) => match f64::value_from(v) {
                Ok(v) => v,
                Err(_) => {
                    return None;
                }
            },
            None => {
                return None;
            }
        };

        let off = match f64::value_from(state.off) {
            Ok(v) => v,
            Err(_) => {
                return None;
            }
        };

        let pass_count = f64::value_from(self.pass_count).unwrap();

        let mut estimate_pass_count = pass_count + 1.0;
        if estimate_pass_count < 2.0 {
            estimate_pass_count = 2.0;
        }

        let cur_pass_progress = off / size;
        let progress = (pass_count + cur_pass_progress) / (estimate_pass_count);

        Some(progress)
    }
}
