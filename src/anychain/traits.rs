use crate::anychain::*;

// XXX create a namespace for every type

impl Hashable for Hash {
    fn hash(&self) -> LazyHash {
        LazyHash::from_hash(self)
    }
}

impl Hashable for &[u8] {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_BYTES, self)
    }
}

impl Hashable for bool {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_BOOL, if *self { b"true" } else { b"false" })
    }
}

impl Hashable for &str {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_STR, self.as_bytes())
    }
}

impl Hashable for String {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_STR, self.as_bytes())
    }
}

impl Hashable for u64 {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_U64, self.to_be_bytes().as_ref())
    }
}

impl Hashable for i64 {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_I64, self.to_be_bytes().as_ref())
    }
}

impl Hashable for f64 {
    fn hash(&self) -> LazyHash {
        hash_raw(HEADER_F64, self.to_bits().to_be_bytes().as_ref())
    }
}

impl<T> Hashable for Vec<T>
where
    T: Hashable,
{
    fn hash(&self) -> LazyHash {
        hash_iter(self)
    }
}

impl<K, V> Hashable for std::collections::HashMap<K, V>
where
    K: Hashable + PartialOrd,
    V: Hashable,
{
    fn hash(&self) -> LazyHash {
        let mut v = self.iter().map(|(k, v)| (k, v)).collect();
        hash_map(&mut v)
    }
}
