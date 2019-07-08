
// see https://github.com/rustwasm/wasm-bindgen/issues/1642
class _WatchersWrapper {
    constructor(wrappers) {
        this.wrappers = wrappers;
    }

    into_inner() {
        return this.wrappers;
    }
}

global.WatchersWrapper = _WatchersWrapper;

let alias = require("./alias.js");

let jsfile = require("./jsfile.js");

let myDump = new jsfile.SynchronousURLFile('http://localhost:8080/dump-my_activity.tgz');
//let myDump = new jsfile.SynchronousURLFile('http://localhost:8080/dump-10G-photos.tgz');

let archive = new alias.rs.TarGzArchive(myDump);

let w = new alias.rs.JsWatchers();
w.open("Takeout/My Activity/Assistant/MyActivity.json", function(path, reader) {
    let buf = new Uint8Array(8);
    reader.read(buf);
    console.log("myactivity.json found", path, reader, buf);
    reader.drop();


    let w = new alias.rs.JsWatchers();
    w.open("pouet", function(path, readCb) { console.log("pouet"); });
    return new WatchersWrapper(w);
});

archive.watch(w);

for (;;) {
    let r = archive.step();
    if (!r) {
        break;
    }
}


/*
let debug = alias.alias.debug;
let steal_cb = null;
debug(myDump, function(entryGetter) {
    let entry = entryGetter();

    let buf = new Uint8Array(8);
    entry.read(buf);

    console.log(entry, entry.get_path(), buf);
});
*/
