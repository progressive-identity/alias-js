// XXX implement with blake2b::many::*;

mod js;
mod sign;
pub mod traits;
mod writer;

use base64;
use blake2b;
use std::*;
pub use traits::*;
use wasm_bindgen::prelude::*;

pub use writer::*;

pub const HEADER_NULL: &[u8] = b"null";
pub const HEADER_BYTES: &[u8] = b"bytes";
pub const HEADER_STR: &[u8] = b"str";
pub const HEADER_U64: &[u8] = b"u64";
pub const HEADER_I64: &[u8] = b"i64";
pub const HEADER_F64: &[u8] = b"f64";
pub const HEADER_BOOL: &[u8] = b"bool";
pub const HEADER_LIST: &[u8] = b"list";
pub const HEADER_MAP: &[u8] = b"map";

#[wasm_bindgen]
pub struct Hash([u8; blake2b::OUTBYTES]);

#[wasm_bindgen]
impl Hash {
    pub fn as_base64(&self) -> String {
        base64::encode_config(&self.0[..], base64::STANDARD_NO_PAD)
    }

    pub fn from_base64(s: String) -> Result<Hash, JsValue> {
        let v = match base64::decode_config(&s, base64::STANDARD_NO_PAD) {
            Err(_) => {
                return Err(JsValue::from_str("invalid base64"));
            }
            Ok(v) => {
                if v.len() != 64 {
                    return Err(JsValue::from_str("bad hash length"));
                }

                v
            }
        };

        if v.len() != 64 {
            return Err(JsValue::from_str("bad hash length"));
        }

        let mut h = Hash([0; blake2b::OUTBYTES]);
        h.0.copy_from_slice(&v);
        Ok(h)
    }

    pub fn clone(&self) -> Self {
        let mut h = Hash([0; blake2b::OUTBYTES]);
        h.0.copy_from_slice(&self.0);
        h
    }

    /*
    pub fn from_bytes(v: Box<[u8]>) -> Result<Hash, JsValue> {
        if v.len() != 64 {
            return Err(JsValue::from_str("bad hash length"));
        }

        let mut h = Hash([0; blake2b::OUTBYTES]);
        h.0.copy_from_slice(&v);
        Ok(h)
    }
    */
}

impl std::fmt::Display for Hash {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_base64())
    }
}

impl AsRef<[u8]> for Hash {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

impl From<blake2b::Hash> for Hash {
    fn from(v: blake2b::Hash) -> Self {
        let mut h = Hash([0; blake2b::OUTBYTES]);
        h.0.copy_from_slice(&v.as_bytes());
        h
    }
}

pub enum LazyHash {
    Value(Hash),
}

impl LazyHash {
    pub fn from_blake2b(v: blake2b::Hash) -> Self {
        LazyHash::Value(Hash::from(v))
    }

    pub fn from_hash(h: &Hash) -> Self {
        LazyHash::Value(h.clone())
    }

    pub fn into_value(self) -> Hash {
        match self {
            LazyHash::Value(h) => h,
        }
    }
}

pub trait Hashable {
    fn hash(&self) -> LazyHash;
}

pub fn hash<T: Hashable>(v: &T) -> LazyHash {
    v.hash()
}

pub fn new_state_raw(t: &[u8]) -> blake2b::State {
    let mut state = blake2b::State::new();
    state.update(t);
    state.update(b"\x00");
    state
}

pub fn hash_raw(t: &[u8], v: &[u8]) -> LazyHash {
    let mut state = new_state_raw(t);
    state.update(v);
    LazyHash::from_blake2b(state.finalize())
}

pub fn hash_null() -> LazyHash {
    LazyHash::from_blake2b(new_state_raw(HEADER_NULL).finalize())
}

pub struct HashableList {
    state: blake2b::State,
}

impl HashableList {
    pub fn new() -> Self {
        Self {
            state: new_state_raw(HEADER_LIST),
        }
    }

    pub fn push<T: Hashable>(&mut self, v: &T) {
        let h = v.hash().into_value();
        self.state.update(h.as_ref());
    }
}

impl Hashable for HashableList {
    fn hash(&self) -> LazyHash {
        LazyHash::from_blake2b(self.state.finalize())
    }
}

pub fn hash_iter<'a, 'b, I, T>(v: I) -> LazyHash
where
    'b: 'a,
    I: IntoIterator<Item = &'a T>,
    T: 'b + Hashable,
{
    let mut hl = HashableList::new();
    for i in v {
        hl.push(i);
    }
    hl.hash()
}

pub fn hash_sorted_map<'a, 'b, 'c, 'd, I, K, V>(it: I) -> LazyHash
where
    'c: 'a,
    'd: 'b,
    I: IntoIterator<Item = (&'a K, &'b V)>,
    K: 'c + Hashable + PartialOrd,
    V: 'd + Hashable,
{
    let mut hl_k = HashableList::new();
    let mut hl_v = HashableList::new();

    for (k, v) in it {
        hl_k.push(k);
        hl_v.push(v);
    }

    let mut state = new_state_raw(HEADER_MAP);
    state.update(hl_k.hash().into_value().as_ref());
    state.update(hl_v.hash().into_value().as_ref());
    LazyHash::from_blake2b(state.finalize())
}

pub fn hash_map<K, V>(v: &mut Vec<(&K, &V)>) -> LazyHash
where
    K: Hashable + PartialOrd,
    V: Hashable,
{
    v.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    hash_sorted_map(v.iter().map(|(k, v)| (*k, *v)))
}
