mod archive;
mod jsfile;
mod jsreader;
mod utils;
mod wasm;

use crate::archive::watcher;
use crate::utils::io_error_to_js_error;
use log::*;
use std::io::{Read, Write};
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
struct TarGzArchiveReader {
    js_file: Option<jsfile::JsFile>,
    inner: Option<archive::TarIterator<flate2::read::GzDecoder<io::BufReader<jsfile::File>>>>,
    watchers: watcher::Watchers,
}

#[wasm_bindgen]
impl TarGzArchiveReader {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: jsfile::JsFile) -> TarGzArchiveReader {
        let mut archive = TarGzArchiveReader {
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
        let inner = archive::TarIterator::new(file);
        self.inner = Some(inner);
    }

    pub fn watch(&mut self, w: archive::JsWatchers) {
        self.watchers.append(watcher::Watchers::from(w));
    }

    pub fn step(&mut self) -> Result<bool, JsValue> {
        use archive::ArchiveIterator;
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
                .into_inner();
            self.js_file = Some(js_file);
            self.init_inner();
        }
    }
}

#[wasm_bindgen]
struct TarGzArchiveWriter {
    inner: tar::Builder<flate2::write::GzEncoder<io::BufWriter<jsfile::File>>>,
}

#[wasm_bindgen]
impl TarGzArchiveWriter {
    #[wasm_bindgen(constructor)]
    pub fn new(js_file: jsfile::JsFile) -> TarGzArchiveWriter {
        let file = jsfile::File::new(js_file);
        let file = io::BufWriter::with_capacity(2 * 1024 * 1024, file);
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
        header.set_size(js_reader.size());
        io_error_to_js_error(self.inner.append_data(&mut header, path, js_reader))?;
        Ok(())
    }

    pub fn finish(self) -> Result<(), JsValue> {
        io_error_to_js_error((move || {
            self.inner
                .into_inner()?
                .finish()?
                .into_inner()?
                .into_inner();
            Ok(())
        })())
    }
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
