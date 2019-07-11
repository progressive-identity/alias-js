use std::cell::RefCell;
use std::io;
use std::io::{Read, Seek, SeekFrom};
use std::pin::Pin;
use std::rc::Rc;

#[derive(Clone)]
pub struct ReadProbeInner {
    pub off: u64,
    pub size: Option<u64>,
}

#[derive(Clone)]
pub struct ReadProbe(Pin<Rc<RefCell<ReadProbeInner>>>);

impl ReadProbe {
    pub fn new() -> ReadProbe {
        return ReadProbe(Rc::pin(RefCell::new(ReadProbeInner { off: 0, size: None })));
    }

    fn set_size(&self, size: u64) {
        let probe_pin_ref = Pin::as_ref(&self.0);
        let mut probe_mut = probe_pin_ref.borrow_mut();
        probe_mut.size = Some(size);
    }

    fn set_offset(&self, off: u64) {
        let probe_pin_ref = Pin::as_ref(&self.0);
        let mut probe_mut = probe_pin_ref.borrow_mut();
        probe_mut.off = off;
    }

    fn add_offset(&self, off: u64) {
        let probe_pin_ref = Pin::as_ref(&self.0);
        let mut probe_mut = probe_pin_ref.borrow_mut();
        probe_mut.off = probe_mut.off + off;
    }

    pub fn get(&self) -> ReadProbeInner {
        Pin::as_ref(&self.0).borrow().clone()
    }
}

pub struct ProbeReader<R: Read + Seek> {
    read: R,
    probe: ReadProbe,
    is_init: bool,
}

impl<R> ProbeReader<R>
where
    R: Read + Seek,
{
    pub fn new(read: R, probe: &ReadProbe) -> Self {
        Self {
            read: read,
            probe: probe.clone(),
            is_init: false,
        }
    }

    fn init(&mut self) -> io::Result<()> {
        if self.is_init {
            return Ok(());
        }

        self.is_init = true;

        let size = self.size()?;
        self.probe.set_size(size);
        Ok(())
    }

    fn size(&mut self) -> io::Result<u64> {
        let cur_pos = self.read.seek(SeekFrom::Current(0))?;
        let size = self.read.seek(SeekFrom::End(0))?;
        self.read.seek(SeekFrom::Start(cur_pos))?;
        Ok(size)
    }

    pub fn into_inner(self) -> R {
        self.probe.set_offset(0 as u64);
        self.read
    }
}

impl<R> Read for ProbeReader<R>
where
    R: Read + Seek,
{
    fn read(&mut self, out_buf: &mut [u8]) -> io::Result<usize> {
        self.init()?;
        let size = self.read.read(out_buf)?;

        self.probe.add_offset(size as u64);

        Ok(size)
    }
}

impl<R> Seek for ProbeReader<R>
where
    R: Read + Seek,
{
    fn seek(&mut self, pos: SeekFrom) -> io::Result<u64> {
        self.init()?;
        let off = self.read.seek(pos)?;
        self.probe.set_offset(off);

        Ok(off)
    }
}
