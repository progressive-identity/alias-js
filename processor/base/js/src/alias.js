const wasm = require("./wasm.js")

if (!('toJSON' in Error.prototype))
Object.defineProperty(Error.prototype, 'toJSON', {
    value: function () {
        var alt = {};

        Object.getOwnPropertyNames(this).forEach(function (key) {
            alt[key] = this[key];
        }, this);

        return alt;
    },
    configurable: true,
    writable: true
});

// see https://github.com/rustwasm/wasm-bindgen/issues/1642
class _WatchersWrapper {
    constructor(wrappers) {
        this.wrappers = wrappers;
    }

    into_inner() {
        return this.wrappers;
    }
}

class _HashWrapper {
    constructor(h) {
        this.h = h;
    }

    as_hash() {
        // XXX have to clone the hash else Rust borrows it
        return this.h.clone();
    }
}

async function init() {
}

global.Alias = {};
global.Alias.WatchersWrapper = _WatchersWrapper;
global.Alias.HashWrapper = _HashWrapper;

module.exports.HashWrapper = _HashWrapper;
module.exports.Processor = require("./processor.js").Processor;
module.exports.RawWriter = wasm.RawWriter;
module.exports.Scope = require("./scope.js").Scope;
module.exports.TarGzArchiveReader = wasm.TarGzArchiveReader;
module.exports.ZipArchiveReader = wasm.ZipArchiveReader;
module.exports.TarGzArchiveWriter = wasm.TarGzArchiveWriter;
module.exports.Watchers = wasm.JsWatchers;
module.exports.WatchersWrapper = _WatchersWrapper;
module.exports.file = require("./jsfile.js")
module.exports.init = init;
