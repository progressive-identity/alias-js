const to_utf8 = require('./wasm.js').to_utf8;
const syncRequest = require('sync-request');

/** JSFile is an interface for any file-like object managed JS-side. Rust makes
 * JSFile objects have the std::io::Read trait.
 */
class JsFile {
    // synchronous! blocks until read is performed
    read(start, end) {
        throw "not implemented";
    }

    // synchronous! blocks until size's file is fetched
    size() {
        throw "not implemented";
    }

    // only cache data
    write(buf) {
        throw "not implemented";
    }

    // synchronous! called when file write is finished
    finish() {
        throw "not implemented";
    }

    write_string(s) {
        this.write(to_utf8(s));
    }
};


/* Read a file with its URL synchronously.
 *
 * In Node.JS, it currently blocks the all process, but it is fine as Node
 * should only process Alias data. In the Web, synchronous request are OK as
 * only performed in a Web Worker
 */
class UrlReaderSync extends JsFile {
    constructor(args) {
        super();
        this.args = args;
        this._cachedSize = this.args.size || null;
    }

    read(start, end) {
        if (start >= end) {
            throw "start >= end";
        }

        console.debug('fetch ' + this.args.url + ': ' + (start/1024/1024) + '-' + (end/1024/1024) + 'MB');

        const headers = {...(this.args.headers || {}), ...{
            'Range': 'bytes=' + start + '-' + (end-1),
        }};

        let res = syncRequest('GET', this.args.url, {
            headers: headers,
        });

        let body = res.body;

        if (res.statusCode != 206) {
            throw "statusCode is " + res.statusCode + ", not 206";
        }

        let buf8 = new Uint8Array(body);
        return buf8;
    }

    size() {
        if (this._cachedSize == null) {
            let res = syncRequest('HEAD', this.args.url);

            if (res.statusCode != 200) {
                return null;
            }

            let content_length = res.headers['content-length'];
            let size = parseInt(content_length);
            if (isNaN(size)) {
                return null;
            }

            this._cachedSize = size;
        }

        return this._cachedSize;
    }
}

class UrlWriterSync extends JsFile {
    constructor(url) {
        super();
        this.url = url;
        this._created = false;
        this._offset = 0;
    }

    write(buf) {
        if (buf.length == 0) {
            return;
        }

        if (!this._created) {
            // XXX
            this._created = true;
        }

        let length = buf.length;
        let start = this._offset;
        let end = this._offset + length - 1;
        let self = this;

        // NodeJS only accepts Buffer
        buf = Buffer.from(buf);

        syncRequest('PUT', this.url, {
            headers: {
                'Range': '' + start + '-' + end,
                'Content-Type': "application/octet-stream",
            },
            body: buf,
        });

        self._offset += length;
    }

    finish() {
        syncRequest('POST', this.url, {
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({"action": "finish"}),
        });
    }
}

module.exports.JsFile = JsFile;
module.exports.UrlReaderSync = UrlReaderSync;
module.exports.UrlWriterSync = UrlWriterSync;
