const Worker = require("tiny-worker");

class Processor {
    constructor(args) {
        if (!args.client_url) throw "missing field client_url";
        if (!args.inp) throw "missing field inp";
        if (!args.scopes) throw "missing field scopes";

        this._args = args;
        this._worker = new Worker("./processor_worker.js");
        this._worker.onmessage = this._onmessage.bind(this);
        this._rpc_id = 0;
        this._rpc_promises = {};
    }

    terminate() {
        this._worker.terminate();
        this._worker = null;
    }

    _new_rpc_id() {
        let id = this._rpc_id;
        this._rpc_id += 1;
        return id;
    }

    _call(method, data) {
        return new Promise((resolve, reject) => {
            const id = this._new_rpc_id();
            this._rpc_promises[id] = [resolve, reject];
            this._worker.postMessage({
                id: id,
                method: method,
                data: data
            });
        });
    }

    _onmessage(ev) {
        const data = ev.data;

        if ('id' in data) {
            const [resolve, reject] = this._rpc_promises[data.id];
            delete this._rpc_promises[data.id];

            if ("error" in data) {
                return reject(data.error);
            }

            resolve(data.data);
        } else if ('method' in data) {
            const method = data.method;
            const args = data.data;

            if (method == 'progress') {
                if (this._args.onprogress !== undefined) {
                    this._args.onprogress(args);
                }

            } else {
                throw 'unknown received method from worker: ' + method;
            }

        } else {
            throw 'unknown received payload from worker';
        }
    }

    ping(args) {
        return this._call("ping", args || {});
    }

    init() {
        return this._call("init", this._args);
    }

    run() {
        return this._call("run");
    }
}

module.exports.Processor = Processor;
