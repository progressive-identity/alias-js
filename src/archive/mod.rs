mod archive_from_iterator;
pub mod js_watcher;
pub mod tar;
pub mod watcher;

pub use archive_from_iterator::ArchiveFromIterator;
pub use js_watcher::JsWatchers;
use std::borrow::Cow;
use std::io::Read;
use std::path::Path;
use std::*;
pub use watcher::Watchers;

pub trait ArchiveIterator: Read {
    fn next(&mut self) -> io::Result<Option<()>>;
    fn path(&self) -> io::Result<Cow<Path>>;
}

pub trait Archive {
    fn open<P: AsRef<Path>>(&mut self, path: P, cb: Box<Fn(&Path, &Read) -> io::Result<()>>);
}
