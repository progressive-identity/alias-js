use crate::anychain::Hash;
use blake2b;
use std::io::{Result, Write};

pub struct Blake2bWrite<W> {
    state: blake2b::State,
    write: W,
}

impl<W: Write> Blake2bWrite<W> {
    pub fn new(write: W) -> Self {
        Self {
            state: blake2b::State::new(),
            write: write,
        }
    }

    pub fn finish(self) -> (W, Hash) {
        (self.write, Hash(self.state.finalize()))
    }
}

impl<W: Write> Write for Blake2bWrite<W> {
    fn write(&mut self, in_buf: &[u8]) -> Result<usize> {
        self.state.update(in_buf);
        self.write.write(in_buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.write.flush()
    }
}
