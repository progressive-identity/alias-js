let syncRequest = require('sync-request');

/** JSFile is an interface for any file-like object managed JS-side. Rust makes
 * JSFile objects have the std::io::Read trait.
 */
class JSFile {
    read(start, end) {
        return new Uint8Array();
    }

    size() {
        return 0;
    }
};


/* Read a file with its URL synchronously.
 *
 * In Node.JS, it currently blocks the all process, but it is fine as Node
 * should only process Alias data. In the Web, synchronous request are OK as
 * only performed in a Web Worker
 */
class SynchronousURLFile extends JSFile {
    constructor(url) {
        super();
        this.url = url;
        this._cachedSize = null;
    }

    read(start, end) {
        if (start >= end) {
            throw "start >= end";
        }

        console.debug('fetch ' + this.url + ': ' + (start/1024/1024) + '-' + (end/1024/1024) + 'MB');

        let res = syncRequest('GET', this.url, {
            headers: {
                'range': '' + start + '-' + (end-1),
            }
        });

        if (res.statusCode != 206) {
            return null;
        }

        let body = res.body;
        let buf8 = new Uint8Array(body);
        return buf8;
    }

    size() {
        if (this._cachedSize == null) {
            let res = syncRequest('HEAD', this.url);

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

module.exports.JSFile = JSFile;
module.exports.SynchronousURLFile = SynchronousURLFile;
