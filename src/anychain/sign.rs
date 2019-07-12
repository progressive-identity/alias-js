use crate::anychain::Hash;
use ed25519::*;
use wasm_bindgen::prelude::*;

use rand::thread_rng;

#[wasm_bindgen]
pub fn ed25519_generate() -> Box<[u8]> {
    let mut csprng = thread_rng();
    Box::new(Keypair::generate(&mut csprng).to_bytes())
}

#[wasm_bindgen]
pub fn ed25519_into_public(sec: Box<[u8]>) -> Result<Box<[u8]>, JsValue> {
    match Keypair::from_bytes(&sec) {
        Ok(sec) => Ok(Box::new(sec.public.to_bytes())),
        Err(_) => Err(JsValue::from_str("bad secret key")),
    }
}

#[wasm_bindgen]
pub fn ed25519_sign(sec: Box<[u8]>, h: &Hash) -> Result<Box<[u8]>, JsValue> {
    match Keypair::from_bytes(&sec) {
        Err(_) => Err(JsValue::from_str("bad secret key")),
        Ok(sec) => {
            // XXX add context
            // XXX use sign_prehashed
            let sig = sec.sign(h.as_ref());
            Ok(Box::new(sig.to_bytes()))
        }
    }
}

#[wasm_bindgen]
pub fn ed25519_verify(pubk: Box<[u8]>, h: &Hash, sig: Box<[u8]>) -> Result<(), JsValue> {
    let pubk = match PublicKey::from_bytes(&pubk) {
        Err(_) => {
            return Err(JsValue::from_str("bad public key"));
        }
        Ok(pubk) => pubk,
    };

    let sig = match Signature::from_bytes(&sig) {
        Err(_) => {
            return Err(JsValue::from_str("bad signature"));
        }
        Ok(sig) => sig,
    };

    match pubk.verify(h.as_ref(), &sig) {
        Ok(()) => Ok(()),
        Err(_) => Err(JsValue::from_str("bad signature")),
    }
}
