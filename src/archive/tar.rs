use crate::archive::ArchiveIterator;
use std::borrow::Cow;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::*;
use tar::Header;

fn other(msg: &str) -> io::Error {
    io::Error::new(io::ErrorKind::Other, msg)
}

#[cfg(windows)]
/// On windows we cannot accept non-unicode bytes because it
/// is impossible to convert it to UTF-16.
pub fn bytes2path(bytes: Cow<[u8]>) -> io::Result<Cow<Path>> {
    return match bytes {
        Cow::Borrowed(bytes) => {
            let s = r#try!(str::from_utf8(bytes).map_err(|_| not_unicode(bytes)));
            Ok(Cow::Borrowed(Path::new(s)))
        }
        Cow::Owned(bytes) => {
            let s =
                r#try!(String::from_utf8(bytes).map_err(|uerr| not_unicode(&uerr.into_bytes())));
            Ok(Cow::Owned(PathBuf::from(s)))
        }
    };

    fn not_unicode(v: &[u8]) -> io::Error {
        other(&format!(
            "only unicode paths are supported on windows: {}",
            String::from_utf8_lossy(v)
        ))
    }
}

#[cfg(any(unix, target_os = "redox"))]
/// On unix this operation can never fail.
pub fn bytes2path(bytes: Cow<[u8]>) -> io::Result<Cow<Path>> {
    use std::ffi::{OsStr, OsString};
    use std::os::unix::ffi::{OsStrExt, OsStringExt};

    Ok(match bytes {
        Cow::Borrowed(bytes) => Cow::Borrowed({ Path::new(OsStr::from_bytes(bytes)) }),
        Cow::Owned(bytes) => Cow::Owned({ PathBuf::from(OsString::from_vec(bytes)) }),
    })
}

#[cfg(target_arch = "wasm32")]
pub fn bytes2path(bytes: Cow<[u8]>) -> io::Result<Cow<Path>> {
    Ok(match bytes {
        Cow::Borrowed(bytes) => {
            Cow::Borrowed({ Path::new(str::from_utf8(bytes).map_err(invalid_utf8)?) })
        }
        Cow::Owned(bytes) => {
            Cow::Owned({ PathBuf::from(String::from_utf8(bytes).map_err(invalid_utf8)?) })
        }
    })
}

#[cfg(target_arch = "wasm32")]
fn invalid_utf8<T>(_: T) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "Invalid utf8")
}
/// Try to fill the buffer from the reader.
///
/// If the reader reaches its end before filling the buffer at all, returns `false`.
/// Otherwise returns `true`.
fn try_read_all<R: Read>(r: &mut R, buf: &mut [u8]) -> io::Result<Option<usize>> {
    let mut read = 0;
    while read < buf.len() {
        match r.read(&mut buf[read..])? {
            0 => {
                if read == 0 {
                    return Ok(None);
                }

                return Err(other("failed to read entire block"));
            }
            n => read += n,
        }
    }
    Ok(Some(read))
}

pub struct TarIterator<R: Read> {
    f: R,
    pos: u64,
    next: u64,
    end_pos: Option<u64>,
    header: Option<Header>,
    long_pathname: Option<Vec<u8>>,
    pax_extensions: Option<Vec<u8>>,
}

impl<R> TarIterator<R>
where
    R: Read,
{
    pub fn new(r: R) -> Self {
        let r = TarIterator {
            f: r,
            pos: 0,
            end_pos: None,
            next: 0,
            header: None,
            long_pathname: None,
            pax_extensions: None,
        };

        r
    }

    pub fn into_inner(self) -> R {
        self.f
    }

    fn skip(&mut self, mut amt: u64) -> io::Result<()> {
        let mut buf = [0u8; 4096 * 8];
        while amt > 0 {
            let n = cmp::min(amt, buf.len() as u64);
            let n = self.f.read(&mut buf[..n as usize])?;
            if n == 0 {
                return Err(other("unexpected EOF during skip"));
            }
            amt -= n as u64;
            self.pos += n as u64;
        }
        Ok(())
    }

    fn next_raw(&mut self) -> io::Result<Option<Header>> {
        self.end_pos = None;

        // Skip to next header
        self.skip(self.next - self.pos)?;

        // Read header, checking EOF
        let mut header = Header::new_old();
        let read = try_read_all(&mut self.f, header.as_mut_bytes())?;
        if read.is_none() {
            return Ok(None);
        }
        self.pos += read.unwrap() as u64;

        // EOF if header is all zeros
        if header.as_bytes().iter().all(|i| *i == 0) {
            return Ok(None);
        }

        self.next += 512;

        // Make sure the checksum is ok
        let cksum = header.cksum()?;
        let sum = header.as_bytes()[..148]
            .iter()
            .chain(&header.as_bytes()[156..])
            .fold(0, |a, b| a + (*b as u32))
            + 8 * 32;
        if sum != cksum {
            return Err(other("archive header checksum mismatch"));
        }

        // Calculate
        let size = header.entry_size()?;
        self.end_pos = Some(self.next + size);

        // Store where the next entry is, rounding up by 512 bytes (the size of
        // a header);
        let size = (size + 511) & !(512 - 1);
        self.next += size;

        Ok(Some(header))
    }

    fn read_all(&mut self) -> io::Result<Vec<u8>> {
        // Preallocate some data but don't let ourselves get too crazy now.
        let cap = cmp::min(self.end_pos.unwrap() - self.pos, 128 * 1024);
        let mut v = Vec::with_capacity(cap as usize);
        self.read_to_end(&mut v).map(|_| v)
    }

    pub fn next(&mut self) -> io::Result<Option<()>> {
        self.header = None;
        self.long_pathname = None;
        self.pax_extensions = None;

        let mut processed = 0;
        loop {
            processed += 1;
            let header = match self.next_raw()? {
                Some(header) => header,
                None if processed > 1 => {
                    return Err(other(
                        "members found describing a future member \
                         but no future member found",
                    ));
                }
                None => return Ok(None),
            };

            if header.as_gnu().is_some() && header.entry_type().is_gnu_longname() {
                if self.long_pathname.is_some() {
                    return Err(other(
                        "two long name entries describing \
                         the same member",
                    ));
                }
                self.long_pathname = Some(self.read_all()?);
                continue;
            }

            /*
            if header.as_gnu().is_some() && header.entry_type().is_gnu_longlink() {
                if gnu_longlink.is_some() {
                    return Err(other(
                        "two long name entries describing \
                         the same member",
                    ));
                }
                gnu_longlink = Some(self.read_all()?);
                continue;
            }
            */

            if header.as_ustar().is_some() && header.entry_type().is_pax_local_extensions() {
                if self.pax_extensions.is_some() {
                    return Err(other(
                        "two pax extensions entries describing \
                         the same member",
                    ));
                }
                self.pax_extensions = Some(self.read_all()?);
                continue;
            }

            self.header = Some(header);
            return Ok(Some(()));
        }
    }

    pub fn path(&self) -> io::Result<Cow<Path>> {
        bytes2path(self.path_bytes())
    }

    pub fn path_bytes(&self) -> Cow<[u8]> {
        match self.long_pathname {
            Some(ref bytes) => {
                if let Some(&0) = bytes.last() {
                    Cow::Borrowed(&bytes[..bytes.len() - 1])
                } else {
                    Cow::Borrowed(bytes)
                }
            }
            None => {
                // XXX TODO pax extensions
                if self.pax_extensions.is_some() {
                    eprintln!("PAX extensions not implemented");
                }
                /*if let Some(ref pax) = self.pax_extensions {
                    fn is_newline(a: &u8) -> bool {
                        *a == b'\n'
                    }

                    let pax = pax
                        .split(|i| *i == b'\n')
                        .find(|f| f.key_bytes() == b"path")
                        .map(|f| f.value_bytes());
                    if let Some(field) = pax {
                        return Cow::Borrowed(field);
                    }
                }*/
                self.header.as_ref().unwrap().path_bytes()
            }
        }
    }
}

impl<R> Read for TarIterator<R>
where
    R: Read,
{
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let remaining_size = self.end_pos.unwrap().checked_sub(self.pos).unwrap();
        let r = (&mut self.f).take(remaining_size).read(buf)?;
        self.pos += r as u64;
        Ok(r)
    }
}

impl<R> ArchiveIterator for TarIterator<R>
where
    R: Read,
{
    fn next(&mut self) -> io::Result<Option<()>> {
        self.next()
    }
    fn path(&self) -> io::Result<Cow<Path>> {
        self.path()
    }
    fn as_read_mut(&mut self) -> &mut Read {
        self
    }
}
