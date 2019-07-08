use crate::scope::Scope;
use crate::watcher::Watcher;
use std::io::{Read, Write};
use std::path::Path;
use std::*;

pub struct Processor<R, W, CW>
where
    R: Read,
    W: Write,
    CW: Fn(&Path) -> io::Result<W>,
{
    inp_archs: Vec<R>,
    create: CW,
    scopes: Vec<Scope>,
    watchers: Vec<Box<Watcher>>,
}

impl<R, W, CW> Processor<R, W, CW>
where
    R: Read,
    W: Write,
    CW: Fn(&Path) -> io::Result<W>,
{
    pub fn new(inp_archs: Vec<R>, scopes: Vec<Scope>, create: CW) -> Processor<R, W, CW> {
        Processor {
            inp_archs: inp_archs,
            create: create,
            scopes: scopes,
            watchers: Vec::new(),
        }
    }

    pub fn get_mut_watchers(&mut self) -> &mut Vec<Box<Watcher>> {
        &mut self.watchers
    }

    pub fn pull(&mut self) -> io::Result<()> {
        Ok(())
    }
}
