use crate::archive::{ArchiveIterator, Watchers};
use std::io;
use std::io::Read;

pub struct ArchiveFromIterator<T: ArchiveIterator> {
    inner: T,
}

impl<T> ArchiveFromIterator<T>
where
    T: ArchiveIterator,
{
    pub fn new(inner: T) -> Self {
        Self { inner: inner }
    }

    pub fn step(&mut self, watchers: &mut Watchers) -> io::Result<bool> {
        // Continue only if more works has to be done
        if !watchers.is_active() {
            return Ok(false);
        }

        // Iterate over entries
        let mut did_work = false;
        while !did_work {
            // If no more entries, rewind
            if self.inner.next()?.is_none() {
                // Clear all old watchers
                watchers.next_pass()?;

                return Ok(false);
            }

            let path = self.inner.path()?;
            let path = path.to_path_buf(); // XXX TODO slow!

            if let Some(open) = watchers.opens.remove(&path) {
                did_work = true;

                if let Some(new_w) = (open.cb)(path.as_path(), Some(self))? {
                    watchers.append(new_w);
                }
            }
        }

        Ok(true)
    }

    pub fn into_inner(self) -> T {
        self.inner
    }
}

impl<T> Read for ArchiveFromIterator<T>
where
    T: ArchiveIterator,
{
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        self.inner.read(buf)
    }
}
