pub mod traits;

use blake2b;
use std::*;
pub use traits::*;

pub struct Hash(blake2b::Hash);

impl std::fmt::Display for Hash {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0.to_hex())
    }
}

pub enum HashResult {
    Value(Hash),
}

impl HashResult {
    fn new_value(v: blake2b::Hash) -> Self {
        HashResult::Value(Hash(v))
    }

    fn into_value(self) -> Hash {
        match self {
            HashResult::Value(h) => h,
        }
    }
}

pub trait Hashable {
    fn hash(&self) -> HashResult;
}

pub fn hash<T: Hashable>(v: &T) -> Hash {
    v.hash().into_value()
}

pub fn hash_iter<'a, 'b, I, T>(v: I) -> HashResult
where
    'b: 'a,
    I: IntoIterator<Item = &'a T>,
    T: 'b + Hashable,
{
    let mut state = blake2b::State::new();

    // XXX implement many
    for i in v {
        let h = i.hash().into_value();
        state.update(h.0.as_bytes());
    }

    HashResult::new_value(state.finalize())
}

pub fn hash_map<K, V>(v: &mut Vec<(&K, &V)>) -> HashResult
where
    K: Hashable + PartialOrd,
    V: Hashable,
{
    let mut state_k = blake2b::State::new();
    let mut state_v = blake2b::State::new();

    v.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

    // XXX implement many
    for (k, v) in v {
        let h_k = k.hash().into_value();
        state_k.update(h_k.0.as_bytes());
        let h_v = v.hash().into_value();
        state_v.update(h_v.0.as_bytes());
    }

    let h_k = state_k.finalize();
    let h_v = state_v.finalize();

    hash_iter([h_k.as_bytes(), h_v.as_bytes()].iter())
}

#[test]
fn test() {
    println!("{}", hash(&1.0));
}
