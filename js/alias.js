const alias_rs = require("./alias_rs.js")

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

    into_inner() {
        return this.h;
    }
}

global.Alias = {};
global.Alias.WatchersWrapper = _WatchersWrapper;
global.Alias.HashWrapper = _HashWrapper;

module.exports.rs = alias_rs;
module.exports.Watchers = alias_rs.JsWatchers;
module.exports.file = require("./jsfile.js")
module.exports.Processor = require("./processor.js").Processor;
module.exports.WatchersWrapper = _WatchersWrapper;
module.exports.Scope = require("./scope.js").Scope;
module.exports.HashWrapper = _HashWrapper;
