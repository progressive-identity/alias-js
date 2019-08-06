use crate::archive::watcher::Watchers;
use crate::jsreader;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Alias)]
    type WatchersWrapper;

    #[wasm_bindgen(structural, method)]
    pub fn into_inner(this: &WatchersWrapper) -> JsWatchers;
}

#[wasm_bindgen]
pub struct JsWatchers {
    opens: HashMap<String, js_sys::Function>,
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
    }
}

impl From<JsWatchers> for Watchers {
    fn from(js_watchers: JsWatchers) -> Self {
        use wasm_bindgen::JsCast;

        let mut watchers = Self::new();

        for (path, cb) in js_watchers.opens {
            watchers.open(
                path,
                Box::new(move |mut entry| {
                    let reader = if entry.is_found() {
                        let r = entry.reader.as_mut().unwrap();
                        unsafe { jsreader::new(r.read, r.size) }.into()
                    } else {
                        JsValue::NULL
                    };

                    let ret = cb
                        .call2(
                            &JsValue::NULL,
                            &JsValue::from_str(&entry.path.to_string_lossy()),
                            &reader,
                        )
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
