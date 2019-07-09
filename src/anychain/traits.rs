use crate::anychain::{hash_iter, hash_map, HashResult, Hashable};

impl Hashable for &[u8] {
    fn hash(&self) -> HashResult {
        HashResult::new_value(blake2b::blake2b(self))
    }
}

impl Hashable for &str {
    fn hash(&self) -> HashResult {
        self.as_bytes().hash()
    }
}

impl Hashable for String {
    fn hash(&self) -> HashResult {
        self.as_bytes().hash()
    }
}

impl<T> Hashable for Vec<T>
where
    T: Hashable,
{
    fn hash(&self) -> HashResult {
        hash_iter(self)
    }
}

impl<K, V> Hashable for std::collections::HashMap<K, V>
where
    K: Hashable + PartialOrd,
    V: Hashable,
{
    fn hash(&self) -> HashResult {
        let mut v = self.iter().map(|(k, v)| (k, v)).collect();
        hash_map(&mut v)
    }
}

impl Hashable for u64 {
    fn hash(&self) -> HashResult {
        self.to_be_bytes().as_ref().hash()
    }
}

impl Hashable for i64 {
    fn hash(&self) -> HashResult {
        self.to_be_bytes().as_ref().hash()
    }
}

impl Hashable for f64 {
    fn hash(&self) -> HashResult {
        self.to_bits().hash()
    }
}
