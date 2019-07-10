const alias_rs = require("./alias_rs.js")

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
module.exports.WatchersWrapper = _WatchersWrapper;
module.exports.HashWrapper = _HashWrapper;
