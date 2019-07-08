let alias_rs = require("./alias_rs.js")

class ArchiveEntry {
    constructor(path, readCb) {
        this._path = path;
        this._readCb = readCb;
    }

    path() {
        return this._path;
    }

    read(l) {
        return this._readCb(l);
    }
};

// see https://github.com/rustwasm/wasm-bindgen/issues/1642
class _WatchersWrapper {
    constructor(wrappers) {
        this.wrappers = wrappers;
    }

    into_inner() {
        return this.wrappers;
    }
}

global.Alias = {};
global.Alias.ArchiveEntry = ArchiveEntry;
global.Alias.WatchersWrapper = _WatchersWrapper;

module.exports.rs = alias_rs;

