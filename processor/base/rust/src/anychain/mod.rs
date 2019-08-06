// XXX implement with blake2b::many::*;

mod writer;

use base64;
use blake2b;
use std::*;
use wasm_bindgen::prelude::*;

pub use writer::*;

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
