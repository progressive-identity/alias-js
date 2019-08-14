const express = require('express');
const cors = require('cors');
const Anychain = require('@alias/anychain');

const chain = new Anychain();

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
        let self = this;

        const router = express.Router();

        router.get('/alias/', cors(), function(req, res) {
            res.send(chain.toJSON(self.clientDecl));
        });

        return router;
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
