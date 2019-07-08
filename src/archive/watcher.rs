use crate::jsreader;
use std::borrow::Cow;
use std::collections::HashMap;
use std::io;
use std::io::Read;
use std::path::*;
use wasm_bindgen::prelude::*;

type WatcherOpenCallback = FnOnce(String, &mut Read) -> io::Result<Option<Watchers>>;

pub struct WatcherOpen {
    pub cb: Box<WatcherOpenCallback>,
    pass: usize,
}

pub struct Watchers {
    pub opens: HashMap<PathBuf, WatcherOpen>,
}

impl Watchers {
    pub fn new() -> Self {
        Self {
            opens: HashMap::new(),
        }
    }

    pub fn open<P: AsRef<Path>>(&mut self, path: P, cb: Box<WatcherOpenCallback>) {
        self.opens
            .insert(path.as_ref().to_path_buf(), WatcherOpen { cb: cb, pass: 1 });
    }

    pub fn append(&mut self, other: Self) {
        self.opens.extend(other.opens);
    }

    pub fn is_active(&self) -> bool {
        !self.opens.is_empty()
    }

    pub fn next_pass(&mut self) {
        self.opens.retain(|_, v| v.pass > 0);
        self.opens.values_mut().for_each(|v| {
            v.pass -= 1;
        });
    }
}

impl std::fmt::Debug for Watchers {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        let paths: Vec<(Cow<str>, usize)> = self
            .opens
            .iter()
            .map(|(p, w)| (p.as_path().to_string_lossy(), w.pass))
            .collect();
        write!(f, "(opens: {:?})", paths)
    }
}

#[wasm_bindgen]
pub struct JsWatchers {
    opens: HashMap<String, js_sys::Function>,
}

#[wasm_bindgen]
extern "C" {
    pub type WatchersWrapper;

    #[wasm_bindgen(structural, method)]
    pub fn into_inner(this: &WatchersWrapper) -> JsWatchers;
}

#[wasm_bindgen]
impl JsWatchers {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            opens: HashMap::new(),
        }
    }

    pub fn open(&mut self, path: String, cb: js_sys::Function) {
        self.opens.insert(path, cb);
        /* self.inner.open(
            path,
            Box::new(move |path, reader| {
                let js_reader = unsafe { jsreader::new(reader) };
                let r = cb
                    .call2(&JsValue::NULL, &JsValue::from_str(&path), &js_reader.into())
                    .expect("open callback failed");

                /*let b = JsCast::has_type::<JsWatchers>(js_watchers);
                log::debug!("{}", b);*/

                Ok(Watchers::new())
            }),
        );*/
    }
    /*
    pub fn to_js(self) -> JsValue {
        let watchers_list = js_sys::Array::new();

        self.opens.iter().for_each(|(k, v)| {
            let watcher_list = js_sys::Array::new();
            watcher_list.push(&JsValue::from_str("open"));
            watcher_list.push(&JsValue::from_str(k));
            watcher_list.push(v);
            watchers_list.push(&watcher_list);
        });

        JsValue::from(watchers_list)
    }

    pub fn from_js(v: JsValue) -> Self {
        let mut js_watchers = Self::new();
        let watchers_list = js_sys::Array::from(&v);

        for watcher_list in watchers_list.values() {
            let watcher_list = js_sys::Array::from(&watcher_list.unwrap());
            let values = watcher_list.values();

            let type_ = values.next().unwrap().value().as_string().unwrap();

            match type_.as_str() {
                "open" => {
                    let path = values.next().unwrap().value().as_string().unwrap();
                    let cb = js_sys::Function::from(values.next().unwrap().value());

                    js_watchers.open(path, cb);
                }
                _ => {
                    panic!("unknown type");
                }
            };
        }

        js_watchers
    }*/
}

impl From<JsWatchers> for Watchers {
    fn from(js_watchers: JsWatchers) -> Self {
        use wasm_bindgen::JsCast;

        let mut watchers = Self::new();

        for (path, cb) in js_watchers.opens {
            watchers.open(
                path,
                Box::new(move |path, reader| {
                    let js_reader = unsafe { jsreader::new(reader) };
                    let ret = cb
                        .call2(&JsValue::NULL, &JsValue::from_str(&path), &js_reader.into())
                        .expect("open callback failed");

                    // ret might be null
                    if ret.is_undefined() || ret.is_null() {
                        return Ok(None);
                    } else {
                        let js_watchers = ret
                            .dyn_into::<WatchersWrapper>()
                            .expect("bad returned value type")
                            .into_inner();
                        return Ok(Some(Watchers::from(js_watchers)));
                    }
                }),
            );
        }

        watchers
    }
}
