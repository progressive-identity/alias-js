const path = require('path');

// XXX tiny-worker seems to not set __dirname as current path of
// process_worker.js. We need to set it as a constant in the meantime to find a
// better solution.
__fakedirname = "/alias/processor/base/js/src";

const alias = require(path.join(__fakedirname, 'alias.js'));

// XXX
const processors = require(path.join(__fakedirname, '../../../providers', 'all.js'));

class ProcessorApi {
    constructor(pushURL, outs) {
        this._pushURL = pushURL;
        this._outs = outs;
    }

    out_file(path) {
        if (!(path in this._outs)) {
            const url = this._pushURL + "/" + path;
            let fh = new alias.file.UrlWriterSync(url);
            fh = new alias.RawWriter(fh);
            this._outs[path] = {mode: 'file', fh: fh};
        }

        const out = this._outs[path];
        if (out.mode != 'file') {
            throw "not opened as a file";
        }

        return out.fh;
    }

    out_archive(path) {
        if (!(path in this._outs)) {
            const url = this._pushURL + "/" + path + ".tgz";
            const fh = new alias.file.UrlWriterSync(url);
            const archive = new alias.TarGzArchiveWriter(fh);
            this._outs[path] = {mode: 'archive', archive: archive};
        }

        const out = this._outs[path];
        if (out.mode != 'archive') {
            throw "not opened as a file";
        }

        return out.archive;
    }
}

class Handlers {
    constructor() {
        this.proc = null;
        this.outs = {};
    }

    ping(args) {
        return args;
    }

    process_and_exit(args) {
        const stepCount = 16;

        // Parse scopes and define watchers
        let providers = {};
        let watchers = {};
        args.scopes.forEach((scope) => {
            scope = new alias.Scope(scope);

            // Load lazily provider
            const name = scope.provider;
            if (!(name in providers)) {
                const provider = processors.get(name);
                if (!provider) {
                    throw "unknown provider " + name;
                }

                providers[name] = provider;
            }
            const provider = providers[name];

            // Add all watchers
            const re = new RegExp(scope.path);
            for (let k in provider) {
                if (k.match(re)) {
                    watchers[name + "." + k] = provider[k](scope);
                }
            }
        });

        // Create initial watcher
        let p_api = new ProcessorApi(args.pushURL, this.outs);
        let w = new alias.Watchers();
        for (const path in watchers) {
            watchers[path](w, p_api);
        }

        // Create readers
        let inps = args.inp.map((inp) => {
            const fh = new alias.file.UrlReaderSync(inp);
            const archive = new alias.TarGzArchiveReader(fh);
            return archive;
        });

        // XXX TODO multi file archive
        if (inps.length != 1) {
            throw "multi archive not implemented";
        }
        const inp = inps[0];

        // Watch and progress on archive
        inp.watch(w);
        while (inp.step(stepCount)) {
            this._notify_progress(inp.progress());
        }

        // Processing is finished

        // Finalize every output file
        for (const path in this.outs) {
            const out = this.outs[path];
            let h;
            if (out.mode == 'file') {
                h = out.fh.finish();
            } else if (out.mode == 'archive') {
                h = out.archive.finish();
            } else {
                throw "unknown output mode";
            }

            this.outs[path] = h;
        }

        // Notify progress to 100%
        this._notify_progress(1.0);

        // Get output file's hash
        let outs = {};
        for (let path in this.outs) {
            let h = this.outs[path];
            outs[path] = h.as_base64();
        }

        return {
            outs: outs,
        }
    }

    _notify_progress(progress) {
        postMessage({
            method: 'progress',
            data: {
                progress: progress,
            }
        });
    }
}

// RPC handling

const handlers = new Handlers();

onmessage = function (ev) {
    const data = ev.data;
    try {
        if (data.method.startsWith("_")) {
            throw "cannot call private methods";
        }

        let handler = handlers[data.method];
        if (!handler) {
            throw "unknown method: " + data.method;
        }

        const res = handler.bind(handlers)(data.data);

        postMessage({
            id: data.id,
            data: res,
        });
    } catch(e) {
        console.error("worker exception:", e, e.message);
        postMessage({
            id: data.id,
            error: e
        });
    }
}


