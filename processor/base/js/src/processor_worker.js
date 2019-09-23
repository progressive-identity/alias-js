const path = require('path');

// XXX tiny-worker seems to not set __dirname as current path of
// process_worker.js. We need to set it as a constant in the meantime to find a
// better solution.
__fakedirname = "/alias/processor/base/js/src";

const alias = require(path.join(__fakedirname, 'alias.js'));

// XXX
const processorRouter = require(path.join(__fakedirname, '../../../providers', 'all.js'));

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
            const url = this._pushURL + "/" + path + ".tar.gz";
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

    async ping(args) {
        return args;
    }

    async process_and_exit(args) {
        const stepCount = 16;

        // Parse scopes and define watchers
        const processors = {};
        const p_api = new ProcessorApi(args.pushURL, this.outs);
        const w = new alias.Watchers();

        for (let scope of args.scopes) {
            scope = new alias.Scope(scope);

            // Load lazily processor
            const provider = scope.provider;
            if (!(provider in processors)) {
                const processor = processorRouter.get(provider);
                if (!processor) {
                    throw "unknown provider " + provider;
                }

                processors[provider] = processor;
            }
            const processor = processors[provider];

            // Add all handlers
            processors[provider].process(scope, w, p_api);
        }

        // Create readers
        let inps = args.inp.map((inp) => {
            // XXX TODO with mimetypes !

            let archiveCls;
            const name = inp.originalFileName || inp.url;
            if (name.endsWith(".zip")) {
                archiveCls = alias.ZipArchiveReader;
            } else if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
                archiveCls = alias.TarGzArchiveReader;
            } else {
                throw "unknown archive type";
            }

            console.log(inp, archiveCls);
            const fh = new alias.file.UrlReaderSync(inp);
            const archive = new archiveCls(fh);
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

            await Promise.resolve();    // one hop
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

onmessage = async ev => {
    const data = ev.data;
    try {
        if (data.method.startsWith("_")) {
            throw "cannot call private methods";
        }

        let handler = handlers[data.method];
        if (!handler) {
            throw "unknown method: " + data.method;
        }

        const res = await handler.bind(handlers)(data.data);

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
};

