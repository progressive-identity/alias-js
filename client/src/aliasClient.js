const cors = require('cors');
const Anychain = require('@alias/anychain');
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

global.chain = new Anychain();

class AliasClient {
    constructor(opts) {
        //opts = opts || {};
        if (!opts.secretSeed) { throw "no secretSeed set!"; }
        if (!opts.name) { throw "no name set!"; }
        if (!opts.domain) { throw "no domain set!"; }
        if (!opts.company) { throw "no company set!"; }

        opts.dataPath = opts.dataPath || "/client_data";
        opts.scheme = opts.scheme || 'https';
        opts.redirectURL = opts.redirectURL || opts.scheme + "://" + opts.domain + "/alias/cb/";
        opts.pushURL = opts.pushURL || opts.scheme + "://" + opts.domain + "/alias/push/";

        this.opts = opts;
        this._clientDecl = null;
    }

    get signSk() {
        return chain.signSeedKeypair(chain.seedOf(this.opts.secretSeed, 32, "sign"));
    }

    get boxSk() {
        return chain.boxSeedKeypair(chain.seedOf(this.opts.secretSeed, 32, "box"));
    }

    get rawClientDecl() {
        return {
            type: 'alias.client.decl',
            name: this.opts.name,
            desc: this.opts.desc,
            domain: this.opts.domain,
            url: this.opts.url,
            company: this.opts.company,
            redirectURL: this.opts.redirectURL,
            pushURL: this.opts.pushURL,
            legal: this.opts.legal,
            crypto: {
                sign: this.signSk.publicKey,
                box: this.boxSk.publicKey,
            },
        };
    }

    get clientDecl() {
        if (this._clientDecl == null) {
            this._clientDecl = chain.sign(this.signSk, this.rawClientDecl);
        }

        return this._clientDecl;
    }

    get clientId() {
        return this.opts.scheme + '://' + this.opts.domain + '/alias/';
    }

    get router() {
        const router = require('express-promise-router')();

        router.get('/alias/', cors(), (req, res) => {
            res.send(chain.toJSON(this.clientDecl));
        });

        router.post('/alias/grant', async (req, res) => {
            const grant = chain.fromToken(req.body.grant);
            const bind = chain.fromToken(req.body.bind);
            await this.saveGrant(grant, bind);

            res.json({});
        });

        router.put('/alias/push/:grantHash', async (req, res) => {
            const grant = chain.fromJSON(req.body);
            if (chain.fold(grant).base64() !== req.params.grantHash) {
                return res.status(400).json({status: "error", reason: "bad grant hash"});
            }

            await this.saveGrant(grant);
            await this.clearGrantData(grant);
            res.send();
        });

        router.post('/alias/push/:grantHash', async (req, res) => {
            const grantHash = req.params.grantHash;

            if (this.opts.onNewPush) {
                const grant = await this.getGrant(grantHash);
                this.opts.onNewPush(grant);
            }

            res.send();
        });

        router.put('/alias/push/:grantHash/:filename', async (req, res) => {
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
        });

        router.post('/alias/push/:grantHash/:filename', async (req, res) => {
            const grantHash = req.params.grantHash;
            const filename = req.params.filename;

            // XXX

            res.send();

        });

        return router;
    }

    generateContract(args) {
        if (!args.scopes) { throw "no scopes set!"; }
        let contract = {
            type: "alias.contract",
            client: this.clientDecl,
            scopes: args.scopes,
            legal: args.legal,
        };

        return contract;
    }

    _grantPath(grantHash) {
        return path.join(this.opts.dataPath, "grant", grantHash);
    }

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

    async clearGrantData(grant) {
        return new Promise((resolve, reject) => {
            rimraf(path.join(this._grantPath(chain.fold(grant).base64()), "data", "*"), resolve);
        });
    }

    async saveGrantData(grantHash, filename, offset, data) {
        const dataPath = path.join(this._grantPath(grantHash), "data", filename);

        const fh = await fs.promises.open(dataPath, "a+");
        try {
            await fh.write(data, 0, data.length, offset);

        } finally {
            await fh.close();
        }
    }

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
console.log("resJson", resJson);
            if (resJson.status == "error") {
                throw resJson.reason;
            }

            const grantPath = this._grantPath(grantHash);
            const dataPath = path.join(grantPath, "data");

            // XXX TODO better handling of extract of data
            const util = require('util');
            const exec = util.promisify(require('child_process').exec);

            try {
                await exec('tar xfz root.tar.gz && rm root.tar.gz', {
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

    async browse(grantHash, basePath) {
        basePath = basePath || "";

        // XXX TODO better handling of extract of data
        const util = require('util');
        const exec = util.promisify(require('child_process').exec);

        const grantPath = this._grantPath(grantHash);
        const r = await exec('find .', {
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

