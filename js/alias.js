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

global.Alias = {};
global.Alias.ArchiveEntry = ArchiveEntry;

module.exports.rs = alias_rs;

