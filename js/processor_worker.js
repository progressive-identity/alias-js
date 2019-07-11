const path = require('path');
const alias = require(path.join(__dirname, 'alias.js'));
const processors = require(path.join(__dirname, 'processors', 'all.js'));

class ProcessorApi {
    constructor(client_url, outs) {
        this._client_url = client_url;
        this._outs = outs;
    }

    out_file(path) {
        if (!(path in this._outs)) {
            const url = this._client_url + "/" + path;
            let fh = new alias.file.UrlWriterSync(url);
            fh = new alias.rs.RawWriter(fh);
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
            const url = this._client_url + "/" + path + ".tgz";
            const fh = new alias.file.UrlWriterSync(url);
            const archive = new alias.rs.TarGzArchiveWriter(fh);
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
        this.is_init = false;
        this.proc = null;
        this.outs = {};
    }

    ping(args) {
        return args;
    }

    init(args) {
        if (this.is_init) {
            throw "already initialized";
        }

        // Parse scopes and define watchers
        let providers = {};
        let watchers = {};
        args.scopes.forEach((scope) => {
            scope = new alias.Scope(scope.provider, scope.path, scope.predicates, scope.fields);

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
        let p_api = new ProcessorApi(args.client_url, this.outs);
        let w = new alias.Watchers();
        for (const path in watchers) {
            watchers[path](w, p_api);
        }

        // Create readers
        let inps = args.inp.map((inp) => {
            const fh = new alias.file.UrlReaderSync(inp.url, inp.args || {});
            const archive = new alias.rs.TarGzArchiveReader(fh);
            return archive;
        });

        if (inps.length != 1) {
            throw "multi archive not implemented";
        }

        const inp = inps[0];
        inp.watch(w);

        this.inps = inps;
        this.is_init = true;
    }

    run() {
        // process
        while (this.step());

        let outs = {};
        for (let path in this.outs) {
            let h = this.outs[path];
            outs[path] = h.as_hex();
        }

        return {
            outs: outs,
        }
    }

    step() {
        if (!this.is_init) {
            throw "not initialized";
        }

        const should_continue = this.inps[0].step(16);


        if (should_continue) {
            this._notify_progress(this.inps[0].progress());
        } else {
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

            this._notify_progress(1.0);
        }

        return should_continue;
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
        console.error("worker exception:", e);
        postMessage({
            id: data.id,
            error: e.message
        });
    }
}


