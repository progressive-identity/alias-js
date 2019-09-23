const Anychain = require('@alias/anychain');
const child_process = require('child_process');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const mime = require('mime');
const path = require('path');
const rimraf = require('rimraf');
const util = require('util');
const {asyncMiddleware} = require('./utils.js');

global.chain = new Anychain();

const execProcessAsync = util.promisify(child_process.exec);

class AliasClient {
    constructor(opts) {
        opts = opts || {};
        opts.dataPath = opts.dataPath || "/client_data";

        this.opts = opts;
        this.newPush = null;
    }

    on(name, cb) {
        let id;
        if (name == "push") {
            id = "newPush";
        } else {
            throw "unknown event name: " + name;
        }

        if (cb === undefined) {
            delete this[id];
        } else {
            this[id] = cb;
        }

        return this;
    }

    // returns the express router for the public interface of the server.
    get publicRouter() {
        const router = express.Router();

        router.get('/alias/', cors(), (req, res) => {
            res.send(chain.toJSON({
                what: "alias client push server",
            }));
        });

        router.post('/alias/grant', asyncMiddleware(async (req, res) => {
            const grant = chain.fromToken(req.body.grant);
            const bind = chain.fromToken(req.body.bind);
            await this.saveGrant(grant, bind);

            res.json({});
        }));

        router.put('/alias/push/:grantHash', asyncMiddleware(async (req, res) => {
            const grant = chain.fromJSON(req.body);
            if (chain.fold(grant).base64() !== req.params.grantHash) {
                return res.status(400).json({status: "error", reason: "bad grant hash"});
            }

            await this.saveGrant(grant);
            await this.clearGrantData(grant);
            res.send();
        }));

        router.post('/alias/push/:grantHash', asyncMiddleware(async (req, res) => {
            const grantHash = req.params.grantHash;

            if (this.opts.onNewPush) {
                const grant = await this.getGrant(grantHash);
                this.opts.onNewPush(grant);
            }

            res.send();
        }));

        router.put('/alias/push/:grantHash/:filename', asyncMiddleware(async (req, res) => {
            const grantHash = req.params.grantHash;
            const filename = req.params.filename;

            if (req.headers['content-type'] !== 'application/octet-stream') {
                return res.status(400).json({status: "error", reason: "bad content type"});
            }

            let startOffset = 0;
            let size = req.body.length;

            const rangeMatch = req.headers['range'].match(/([0-9]+)-([0-9]+)/);
            if (rangeMatch) {
                startOffset = parseInt(rangeMatch[1]);
                let endOffset = parseInt(rangeMatch[2]);
                let rangeSize = endOffset+1-startOffset;
                if (rangeSize !== size) {
                    return res.status(400).json({status: "error", reason: "range size mismatch with body size"});
                }
            }

            await this.saveGrantData(grantHash, filename, startOffset, req.body);
            res.send();
        }));

        router.post('/alias/push/:grantHash/:filename', asyncMiddleware(async (req, res) => {
            const grantHash = req.params.grantHash;
            const filename = req.params.filename;

            // XXX

            res.send();

        }));

        return router;
    }

    // returns a Express router for the private interface of this server.
    get privateRouter() {
        const router = express.Router();

        router.use("/alias/grant/:grantHash/data/", asyncMiddleware(async (req, res, next) => {
            const force = req.method == 'POST';
            try {
                    await this.fetch(req.params.grantHash, {
                    force: force,
                });
            } catch(e) {
                return res.status(404).json({status: "error", reason: e});
            }
            const rootPath = this.getDataPath(req.params.grantHash);

            const basePath = decodeURIComponent(req.originalUrl.substr(req.baseUrl.length)); // XXX TODO this is dirty

            const filePath = this.getFilePath(req.params.grantHash, basePath);
            const fileStat = await fs.promises.lstat(filePath);

            // if directory, returns a list of files. if not, returns the file
            // content.
            if (fileStat.isDirectory()) {
                const r = await this.browse(req.params.grantHash, basePath);
                res.json({status: "ok", "resources": r});
            } else {
                const fh = fs.createReadStream(filePath);
                res.setHeader("content-type", mime.lookup(filePath));
                fh.pipe(res);
            }
        }));

        return router;
    }

    // returns the base path for a given grant
    _grantPath(grantHash) {
        return path.join(this.opts.dataPath, "grant", grantHash);
    }

    // persistently store a grant and a bind token
    async saveGrant(grant, bind) {
        const grantPath = this._grantPath(chain.fold(grant).base64());
        await fs.promises.mkdir(path.join(grantPath, "data"), { recursive: true });

        const grantTokenPath = path.join(grantPath, "token");
        await fs.promises.writeFile(grantTokenPath, chain.toToken(grant));

        if (bind) {
            // XXX TODO check if bind is older before overwriting it
            const bindTokenPath = path.join(grantPath, "bind_token");
            await fs.promises.writeFile(bindTokenPath, chain.toToken(bind));
        }
    }

    // get a grant persistently stored
    async getGrant(grantHash) {
        const grantTokenPath = path.join(this._grantPath(grantHash), "token");
        const token = await fs.promises.readFile(grantTokenPath);
        const grant = chain.fromToken(token);

        let bind = null;
        try {
            const bindTokenPath = path.join(this._grantPath(grantHash), "bind_token");
            const bindToken = await fs.promises.readFile(bindTokenPath);
            bind = chain.fromToken(bindToken);
        } catch(e) {
            //
        }

        const dataPath = path.join(this._grantPath(grantHash), "data");
        const data = await fs.promises.readdir(dataPath);

        return {
            grant: grant,
            bind: bind,
            data: data,
        };
    }

    // clear all data related to a given grant
    async clearGrantData(grant) {
        return new Promise((resolve, reject) => {
            rimraf(path.join(this._grantPath(chain.fold(grant).base64()), "data", "*"), resolve);
        });
    }

    // save data linked to a grant given its filename and its offset
    async saveGrantData(grantHash, filename, offset, data) {
        const dataPath = path.join(this._grantPath(grantHash), "data", filename);

        const fh = await fs.promises.open(dataPath, "a+");
        try {
            await fh.write(data, 0, data.length, offset);

        } finally {
            await fh.close();
        }
    }

    // fetch the data from the authorization server. Will block until the data
    // is stored.
    async fetch(grantHash, opts) {
        opts = opts || {};
        opts.force = opts.force != null ? opts.force : false;

        const {grant, bind, data} = await this.getGrant(grantHash);
        const processURL = bind.body.origin + "/alias/process";

        if (data.length == 0 || opts.force) {
            const r = await fetch(processURL, {
                method: 'POST',
                body: chain.toToken(grant),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const resJson = await r.json();
            if (resJson.status == "error") {
                throw resJson.reason;
            }

            // did any processing happened?
            if (resJson.processor.length == 0) {
                return;
            }

            const grantPath = this._grantPath(grantHash);
            const dataPath = path.join(grantPath, "data");

            // XXX TODO better handling of extract of data

            try {
                await execProcessAsync('tar xfz root.tar.gz && rm root.tar.gz', {
                    cwd: path.join(grantPath, "data"),
                });
            } catch(e) {
                console.error(e);
            }
        }
    }

    getDataPath(grantHash) {
        return path.join("grants", grantHash, "data");
    }

    // returns a list of file paths recursively stored in a given path for a
    // given grant.
    async browse(grantHash, basePath) {
        basePath = basePath || "";

        // XXX TODO better handling of extract of data
        const grantPath = this._grantPath(grantHash);
        const r = await execProcessAsync('find .', {
            cwd: path.join(grantPath, "data", basePath),
        });

        const listing = r.stdout.split("\n")
            .filter(p => p.length > 0 && p !== "." && p !== "..")
            .map(p => p.substr(2));

        return listing;
    }

    getFilePath(grantHash, basePath) {
        return path.join(this._grantPath(grantHash), "data", basePath);
    }
}

module.exports = AliasClient;

