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
const aliasChains = require('./aliasChains.js')
const url = require('url');

global.chain = new Anychain.Chain();
global.chain.registerValidator(aliasChains.validators);

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

        // receive a new grant. register it if unknown or newer than an already
        // known one.
        router.post('/alias/grant', asyncMiddleware(async (req, res) => {
            const grant = chain.fromToken(req.body.grant);
            const bind = chain.fromToken(req.body.bind);
            await this.saveGrant(grant, bind);

            res.json({});
        }));

        // called by provider when a new transfer is about to start. clear all
        // past data.
        router.put('/alias/push/:contractHash', asyncMiddleware(async (req, res) => {
            const grant = chain.fromToken(req.body.grant);
            const contractHash = req.params.contractHash;

            if (!chain.isSignature(grant, "alias.grant")) {
                return res.status(400).json({status: "error", reason: "not a grant"});
            }

            if (chain.fold(grant.body.contract).base64() !== contractHash) {
                return res.status(400).json({status: "error", reason: "bad grant hash"});
            }

            await this.saveGrant(grant);
            await this.clearContractData(contractHash);

            res.send();
        }));

        // called by provider when a new transfer is finished.
        router.post('/alias/push/:contractHash', asyncMiddleware(async (req, res) => {
            const contractHash = req.params.contractHash;

            if (this.opts.onNewPush) {
                const grant = await this.getGrantByContractHash(contractHash);
                this.opts.onNewPush(grant);
            }

            res.send();
        }));

        // called by provider to upload chunks of data for a particular file
        router.put('/alias/push/:contractHash/:filename', asyncMiddleware(async (req, res) => {
            const contractHash = req.params.contractHash;
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

            await this.writeContractData(contractHash, filename, startOffset, req.body);
            res.send();
        }));

        // called by provider to notify transfer for particular file is
        // finished.
        router.post('/alias/push/:contractHash/:filename', asyncMiddleware(async (req, res) => {
            const contractHash = req.params.contractHash;
            const filename = req.params.filename;

            // XXX

            res.send();

        }));

        return router;
    }

    // returns a Express router for the private interface of this server.
    get privateRouter() {
        const router = express.Router();

        // called by frontend to get the list of data currently stored for a
        // given contract.
        router.use("/alias/contract/:contractHash/data/", asyncMiddleware(async (req, res, next) => {
            const contractHash = req.params.contractHash;
            const contractPath = this._contractPath(contractHash);

            const force = req.method == 'POST';
            try {
                    await this.fetch(contractHash, {
                    force: force,
                });
            } catch(e) {
                console.error("error while fetching:", e);
                return res.status(404).json({status: "error", reason: e});
            }
            const basePath = decodeURIComponent(req.originalUrl.substr(req.baseUrl.length)); // XXX TODO this is dirty

            const filePath = path.join(contractPath, "data", basePath);
            const fileStat = await fs.promises.lstat(filePath);

            // if directory, returns a list of files. if not, returns the file
            // content.
            if (fileStat.isDirectory()) {
                const r = await this.browse(contractHash, basePath);
                res.json({status: "ok", "resources": r});
            } else {
                const fh = fs.createReadStream(filePath);
                res.setHeader("content-type", mime.lookup(filePath));
                fh.pipe(res);
            }
        }));

        return router;
    }

    // returns the base path for a given contract
    _contractPath(contractHash) {
        return path.join(this.opts.dataPath, "contract", contractHash);
    }

    // persistently store a grant and a bind token
    async saveGrant(grant, bind) {
        const contract = grant.body.contract;
        const contractHash = chain.fold(contract).base64();
        const contractPath = this._contractPath(contractHash);

        // compare to current grant, and if not newer, abort
        const oldGrant = await this.getGrantByContractHash(contractHash);
        if (!aliasChains.isGrantNewer(oldGrant, grant)) {
            return;
        }

        // create base directory
        await fs.promises.mkdir(path.join(contractPath, "data"), { recursive: true });

        // if the grant is newer, remove every old data
        await this.clearContractData(contractHash);

        // write grant token
        const grantTokenPath = path.join(contractPath, "grant");
        await fs.promises.writeFile(grantTokenPath, chain.toToken(grant));

        // write bind token
        if (bind) {
            // XXX TODO check if bind is older before overwriting it
            const bindTokenPath = path.join(contractPath, "bind");
            await fs.promises.writeFile(bindTokenPath, chain.toToken(bind));
        }
    }

    // get a grant by its contract hash
    async getGrantByContractHash(contractHash) {
        const contractPath = this._contractPath(contractHash);
        const grantTokenPath = path.join(contractPath, "grant");

        try {
            const grantToken = await fs.promises.readFile(grantTokenPath);
            return chain.fromToken(grantToken);
        } catch (e) {
            return null;
        }
    }

    // get a bind by its contract hash
    async getBindByContractHash(contractHash) {
        const contractPath = this._contractPath(contractHash);
        const bindTokenPath = path.join(contractPath, "bind");

        try {
            const bindToken = await fs.promises.readFile(bindTokenPath);
            return chain.fromToken(bindToken);
        } catch (e) {
            return null;
        }
    }

    // get list of data received for a given contract. Returns null if the
    // contract is unknown.
    async getDataByContractHash(contractHash) {
        const contractPath = this._contractPath(contractHash);
        const dataPath = path.join(contractPath, "data");

        try {
            return await fs.promises.readdir(dataPath);
        } catch(e) {
            return null;
        }
    }

    // clear all data related to a given contract
    async clearContractData(contractHash) {
        const contractPath = this._contractPath(contractHash);
        return new Promise((resolve, reject) => {
            rimraf(path.join(contractPath, "data", "*"), resolve);
        });
    }

    // save data linked to a contract given its filename and its offset
    async writeContractData(contractHash, filename, offset, data) {
        const contractPath = this._contractPath(contractHash);
        const dataPath = path.join(contractPath, "data", filename);

        const fh = await fs.promises.open(dataPath, "a+");
        try {
            await fh.write(data, 0, data.length, offset);

        } finally {
            await fh.close();
        }
    }

    // Will fetch data for a contract. If the data is cached, it is not
    // re-downloaded except if opts.force is set to true. Will block until the
    // data is received and ready to be used.
    async fetch(contractHash, opts) {
        opts = opts || {};
        opts.force = opts.force != null ? opts.force : false;

        // check if data is present
        const data = await this.getDataByContractHash(contractHash);
        if (data.length > 0 && !opts.force) {
            return;
        }

        // reload data
        const bind = await this.getBindByContractHash(contractHash);
        if (bind == null) {
            throw `no bind linked to contract ${contractHash}`;
        }

        const grant = await this.getGrantByContractHash(contractHash);
        if (grant == null) {
            throw `no grant linked to contract ${contractHash}`;
        }

        if (grant.revoked) {
            throw `contract ${contractHash} is revoked`;
        }

        const processURL = bind.body.origin + "/alias/process";
        const body = new url.URLSearchParams();
        body.append('grant', chain.toToken(grant));
        const r = await fetch(processURL, {
            method: 'POST',
            body: body,
        });

        const resJson = await r.json();
        if (resJson.status == "error") {
            throw `provider error while fetching: ${resJson.reason}`;
        }

        // did any processing happened?
        if (resJson.processor.length == 0) {
            return;
        }

        const contractPath = this._contractPath(contractHash);
        const filePath = path.join(contractPath, "data");

        // XXX TODO better handling of extract of data

        try {
            await execProcessAsync('tar xfz root.tar.gz && rm root.tar.gz', {
                cwd: filePath,
            });
        } catch(e) {
            console.error("error while extracting data", e);
        }
    }

    // returns a list of file paths recursively stored in a given path for a
    // given contract.
    async browse(contractHash, basePath) {
        basePath = basePath || "";
        const contractPath = this._contractPath(contractHash);

        // XXX TODO better handling of extract of data
        const r = await execProcessAsync('find .', {
            cwd: path.join(contractPath, "data", basePath),
        });

        const listing = r.stdout.split("\n")
            .filter(p => p.length > 0 && p !== "." && p !== "..")
            .map(p => p.substr(2));

        return listing;
    }
}

module.exports = AliasClient;

