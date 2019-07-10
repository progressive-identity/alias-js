use crate::anychain::*;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = Alias)]
    type HashWrapper;

    #[wasm_bindgen(structural, method)]
    pub fn into_inner(this: &HashWrapper) -> Hash;
}

fn dyn_ref_object(v: &JsValue) -> Option<&js_sys::Object> {
    if let Some(v_obj) = v.dyn_ref::<js_sys::Object>() {
        if v.has_type::<js_sys::Function>() {
            None
        } else {
            Some(v_obj)
        }
    } else {
        None
    }
}

fn do_hash(v: JsValue) -> Result<LazyHash, JsValue> {
    if v.is_null() {
        Ok(hash_null())
    } else if let Some(v) = v.as_f64() {
        // XXX convert to u64 or i64 if appropriate
        Ok(hash(&v))
    } else if let Some(v) = v.as_string() {
        Ok(hash(&v))
    } else if let Some(v) = v.as_bool() {
        Ok(hash(&v))
    } else if let Some(v) = v.dyn_ref::<HashWrapper>() {
        log::debug!("hash");
        Ok(LazyHash::from_hash(&v.into_inner()))
    } else if let Some(v) = v.dyn_ref::<js_sys::Array>() {
        let mut hl = HashableList::new();
        for i in v.values() {
            hl.push(&do_hash(i?)?.into_value());
        }

        Ok(hl.hash())
    } else if let Some(v) = dyn_ref_object(&v) {
        let entries = js_sys::Object::entries(v).sort();

        let mut hl_k = HashableList::new();
        let mut hl_v = HashableList::new();

        for i in entries.values() {
            let i = i?;
            let kv = i.dyn_ref::<js_sys::Array>().unwrap();
            let kv_it = kv.values();
            let k = kv_it.next()?.value();
            let v = kv_it.next()?.value();

            hl_k.push(&do_hash(k)?.into_value());
            hl_v.push(&do_hash(v)?.into_value());
        }

        let mut state = new_state_raw(HEADER_MAP);
        state.update(hl_k.hash().into_value().0.as_bytes());
        state.update(hl_v.hash().into_value().0.as_bytes());
        Ok(LazyHash::from_blake2b(state.finalize()))
    } else {
        Err(JsValue::from_str("non-hashable type"))
    }
}

#[wasm_bindgen(js_name = hash)]
pub fn js_hash(v: JsValue) -> Result<Hash, JsValue> {
    Ok(do_hash(v)?.into_value())
}
