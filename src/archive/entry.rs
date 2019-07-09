use std::io::Read;
use std::path::Path;

pub struct ArchiveEntryReader<'a> {
    pub read: &'a mut Read,
    pub size: u64,
}

pub struct ArchiveEntry<'a> {
    pub path: &'a Path,
    pub reader: Option<ArchiveEntryReader<'a>>,
}

impl<'a> ArchiveEntry<'a> {
    pub fn new(path: &'a Path, read: &'a mut Read, size: u64) -> Self {
        Self {
            path: path,
            reader: Some(ArchiveEntryReader {
                read: read,
                size: size,
            }),
        }
    }

    pub fn not_found(path: &'a Path) -> Self {
        Self {
            path: path,
            reader: None,
        }
    }

    pub fn is_found(&self) -> bool {
        self.reader.is_some()
    }
}
