use crate::archive::ArchiveEntry;
use std::borrow::Cow;
use std::collections::HashMap;
use std::io;
use std::path::*;

type WatcherOpenCallback = FnOnce(ArchiveEntry) -> io::Result<Option<Watchers>>;

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

    pub fn next_pass(&mut self) -> io::Result<()> {
        let mut opens = HashMap::new();
        for (p, mut w) in self.opens.drain() {
            if w.pass > 0 {
                w.pass -= 1;
                opens.insert(p, w);
            } else {
                (w.cb)(ArchiveEntry::not_found(&p))?;
            }
        }
        self.opens = opens;

        Ok(())
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
