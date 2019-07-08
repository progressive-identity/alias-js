mod archive;
mod jsfile;
mod jsreader;
mod utils;
mod wasm;

use crate::archive::watcher;
use crate::utils::io_error_to_js_error;
use log::*;
use std::io::Read;
use std::*;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    wasm::init();
}

pub struct Debug {}
#[wasm_bindgen]
impl Debug {
    pub fn pouet() {
        debug!("pouet from Rust");
    }
}

#[wasm_bindgen]
pub struct Entry {
    path: String,
    read: *mut Read,
}

#[wasm_bindgen]
impl Entry {
    pub fn get_path(&self) -> String {
        self.path.clone()
    }

    pub fn read(&self, buf: &mut [u8]) {
        unsafe { (*self.read).read(buf) }.unwrap();
    }
}

#[wasm_bindgen]
struct TarGzArchive {
    js_file: Option<jsfile::JsFile>,
    inner: Option<
        archive::ArchiveFromIterator<
            archive::tar::TarIterator<flate2::read::GzDecoder<io::BufReader<jsfile::File>>>,
        >,
    >,
    watchers: watcher::Watchers,
}

#[wasm_bindgen]
impl TarGzArchive {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: jsfile::JsFile) -> TarGzArchive {
        let mut archive = TarGzArchive {
            js_file: Some(js_file),
            inner: None,
            watchers: watcher::Watchers::new(),
        };

        archive.init_inner();

        archive
    }

    fn init_inner(&mut self) {
        let js_file = self.js_file.take().unwrap();
        let file = jsfile::File::new(js_file);
        let file = io::BufReader::with_capacity(16 * 1024 * 1024, file);
        let file = flate2::read::GzDecoder::new(file);
        let file = archive::tar::TarIterator::new(file);
        let inner = archive::ArchiveFromIterator::new(file);
        self.inner = Some(inner);
    }

    pub fn watch(&mut self, w: archive::JsWatchers) {
        self.watchers.append(watcher::Watchers::from(w));
    }

    pub fn step(&mut self) -> Result<bool, JsValue> {
        loop {
            let r = self.inner.as_mut().unwrap().step(&mut self.watchers);
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
                .into_inner();
            self.js_file = Some(js_file);
            self.init_inner();
        }
    }
}

/*#[wasm_bindgen]
pub fn debug(jsfile: jsfile::JsFile, cb: js_sys::Function) -> Result<(), JsValue> {
    /*
    while file.next().unwrap().is_some() {
        let entry = Entry {
            path: file.path().unwrap().to_str().unwrap().to_string(),
            read: &mut file,
        };
        let null = JsValue::null();
        let closure = Closure::once(move || entry);
        cb.call1(&null, closure.as_ref())?;
    }*/
    Ok(())
}
*/
