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

        opts.dataPath = opts.dataPath || "client_data";
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

    saveGrant(grant) {
        return new Promise((resolve, reject) => {
            const grantPath = this._grantPath(chain.fold(grant).base64());
            fs.mkdir(path.join(grantPath, "data"), { recursive: true }, (err) => {
                if (err) { return reject(err); }

                const grantTokenPath = path.join(grantPath, "token");
                fs.writeFile(grantTokenPath, chain.toToken(grant), (err) => {
                    if (err) { return reject(err); }
                    resolve(grantPath);
                });
            });
        });
    }

    async getGrant(grantHash) {
        const grantTokenPath = path.join(this._grantPath(grantHash), "token");
        const token = await fs.promises.readFile(grantTokenPath);
        const grant = chain.fromToken(token);

        const dataPath = path.join(this._grantPath(grantHash), "data");
        const data = await fs.promises.readdir(dataPath);

        return {
            grant: grant,
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
}

module.exports = AliasClient;

/*
let o = {
    type: 'alias.client.decl',
    desc: "Teach machines how real people speak.",
    name: "Common Voice",
    domain: 'client.gdpr.dev.local',
    redirect_url: 'http://client.gdpr.dev.local/cb/',
    chain_url: 'http://172.21.0.1:8081/files/debug',
    crypto: {
        sign: signSk.publicKey,
        box: boxSk.publicKey,
    }

};
*/
