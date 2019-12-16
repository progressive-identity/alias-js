class OutputArchive {
    constructor(inner) {
        this._inner = inner;
    }

    copy(path, reader) {
        return this._inner.add_entry_with_reader(path, reader);
    }

    write(path, o) {
        const type = typeof(o);
        if (type == "object" && o.constructor == Uint8Array) {
            // XXX TODO
        } else if (type == "object") {
            return this._inner.add_entry_with_string(path, JSON.stringify(o));
        } else if (type == "string") {
            return this._inner.add_entry_with_string(path, o);
        } else {
            throw "type not readable";
        }
    }
}

class Context {
    constructor(scope, w, p) {
        this._scope = scope;
        this._w = w;
        this._p = p;

        this.out = new OutputArchive(this._p.out_archive("root"));
    }

    initialized() {
        this._w = null;
    }

    filter(it) {
        return this._scope.filter(it);
    }

    get w() {
        if (!this._w) {
            this._w = new alias.Watchers();
        }

        return this._w;
    }

    open(path, cb) {
        return this.w.open(path, (path, reader) => {
            if (this._w !== null) { throw "context not initialized"; }

            cb(path, reader);

            let w = this._w;
            this._w = null;

            if (w) {
                w = new Alias.WatchersWrapper(w);
            }
            return w;
        });
    }

    write(path, o) {
        const realPath = this._scope.provider + "/" + path;
        return this.out.write(realPath, o);
    }

    copy(path) {
        const realPath = this._scope.provider + "/" + path;
        return this.open(path, (path, reader) => {
            if (!reader) { return; }
            this.out.copy(realPath, reader);
        });
    }
}

class ProcessorPath {
    constructor(p, path) {
        this.p = p;
        this.path = path;
    }

    desc(desc) {
        this.p.descByPath[this.path] = desc;
        return this;
    }

    handler(cb) {
        this.p.handlerByPath[this.path] = cb;
        return this;
    }

    model(path, model) {
        const byScope = this.p.modelByScopeByPath[this.path] || {};
        byScope[path] = model;
        this.p.modelByScopeByPath[this.path] = byScope;
        return this;
    }
}

class Processor {
    constructor(opts) {
        if (!opts.name) throw "opts.name not set";
        if (!opts.url) throw "opts.url not set";

        this.name = opts.name;
        this.url = opts.url;
        this.handlerByPath = {};
        this.descByPath = {};
        this.modelByScopeByPath = {};
    }

    path(path) {
        return new ProcessorPath(this, path);
    }

    process(scope, w, p) {
        const ctx = new Context(scope, w, p);
        const re = new RegExp(scope.path);
        const models = {};
        for (const pathIt in this.handlerByPath) {
            if (pathIt.match(re)) {
                this.handlerByPath[pathIt](ctx);

                const model = this.modelByScopeByPath[pathIt];
                if (model) {
                    ctx.out.write("_alias/" + scope.provider + "." + pathIt + ".json", model);
                }
            }
        }
        ctx.initialized();

    }
}

global.Processor = Processor;

function get(provider) {
    if (!provider.match(/[a-z0-9_]+/)) {
        throw "malformed provider";
    }

    try {
        return require(`./${provider}.js`);
    } catch(e) {
        if (e.code == "MODULE_NOT_FOUND") {
            return null;
        }

        throw e;
    }
}

module.exports.get = get;
