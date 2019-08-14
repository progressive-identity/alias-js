global.config = require('../config.json');
global.fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const sodium = require('libsodium-wrappers');
const Anychain = require('@alias/anychain');

const app = express()

global.chain = new Anychain();

app.use(require('morgan')('tiny'));
app.use(require('body-parser')());
app.use(require('cookie-session')({
    name: 'session',
    secret: config.http.cookieSecret,
    maxAge: 1 * 60 * 60 * 1000, // 1h
}));

app.get('/alias/', cors(), (req, res) => {
    res.send({
        what: "alias authz server",
        reqPath: "/request",
    });
});

const storage = require('./storage.js');
const processing = require('./processing.js');

app.use("/api/user", require('./userHandlers.js'));
app.use("/api/session", require('./sessionHandlers.js'));
app.use("/api/storage", storage.router);

app.post("/alias/process", (req, res) => {
    (async () => {
        try {
            var grant = chain.fromJSON(req.body);
            if (!chain.isSignature(grant) || grant.body.type != "alias.grant") {
                throw "expect a token 'alias.grant'";
            }
        } catch(e) {
            return res.status(400).send({status: "error", reason: e});
        }

        // get mapping provider => dumps
        const dumpsByProvider = await storage.getDumps(grant.signer);

        // list scopes by providers
        const scopesByProvider = {};
        for (const scope of grant.body.scopes) {
            const provider = scope.provider;
            scopesByProvider[provider] = scopesByProvider[provider] || [];
            scopesByProvider[provider].push(scope);
        }

        const grantBase64 = chain.fold(grant).base64();
        const pushURL = grant.body.contract.client.body.pushURL + grantBase64;

        await fetch(pushURL, {
            method: 'PUT',
            body: chain.toToken(grant),
            headers: {
                "Content-Type": "application/json",
            }
        })

        const processingCmds = [];
        for (const provider in scopesByProvider) {
            const scopes = scopesByProvider[provider];
            const dumps = dumpsByProvider[provider];

            if (!dumps) {
                continue;
            }

            const processArgs = {
                // XXX return only the most recent dump
                inp: [dumps[0]].map(d => d.rawReqArgs),
                pushURL: pushURL,
                scopes: scopes,
                contract: chain.toJSON(chain.fold(grant.body.contract))
            };

            processingCmds.push(processArgs);
        }

        const process = processingCmds.map(processing.process);
        try {
            var allProcess = await Promise.all(process);
        } catch(e) {
            return res.status(400).send({status: "error", reason: e});
        }

        await fetch(pushURL, {
            method: 'POST',
            body: {"finished": true},
        });

        return res.json({status: 'ok'});
    })();
});

app.use('/', express.static('static'))

sodium.ready.then(() => {
    const listenPort = config.http.listenPort || 8080;

    app.listen(listenPort, () => console.log(`Example app listening on port ${listenPort}!`))
});
