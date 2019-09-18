global.config = require('./config.js');
global.fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const sodium = require('libsodium-wrappers');
const Anychain = require('@alias/anychain');
const {authed, asyncMiddleware} = require('./utils.js');

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
const grants = require('./grant.js');
const history = require('./history.js');

app.use("/api/user", require('./userHandlers.js'));
app.use("/api/session", require('./sessionHandlers.js'));
app.use("/api/grant", grants.router);
app.use("/api/storage", storage.router);

app.get("/api/view/index", authed, asyncMiddleware(async (req, res) => {
    const grantByID = await grants.getGrants(req.alias.publicKey);
    const hist = await history.getHistoryRange(req.alias.publicKey, 0, -1);
    const clientByID = {};

    // provider > path > app > grant
    const viewModel = {};
    for (const grantID in grantByID) {
        const grant = grantByID[grantID];
        for (const scope of grant.body.scopes) {
            const client = grant.body.contract.client;
            const clientID = chain.fold(client).base64();

            clientByID[clientID] = client;

            const byProvider = viewModel[scope.provider] || {};
            const byPath = byProvider[scope.path] || {};
            const byClient = byPath[clientID] || [];
            byClient.push(grantID);

            byPath[clientID] = byClient;
            byProvider[scope.path] = byPath;
            viewModel[scope.provider] = byProvider;
        }
    }

    const r = {
        grants: grantByID,
        clients: clientByID,
        view: viewModel,
        history: hist,
    };

    res.json(chain.toJSON(r));
}));

app.get("/api/view/client/:clientID", authed, asyncMiddleware(async (req, res) => {
    const clientID = req.params.clientID;
    const grantByID = await grants.getGrants(req.alias.publicKey);
    let client = null;

    // app > grant
    const viewModel = [];
    for (const grantID in grantByID) {
        const grant = grantByID[grantID];
        if (chain.fold(grant.body.contract.client).base64() !== clientID) {
            continue;
        }

        client = grant.body.contract.client;

        viewModel.push(grant);
    }

    if (client == null) {
        return res.status(404).json({});
    }

    res.json(chain.toJSON({
        view: viewModel,
        client: client,
    }));
}));

app.post("/alias/process", asyncMiddleware(async (req, res) => {
    try {
        var grant = chain.fromJSON(req.body);
        if (!chain.isSignature(grant) || grant.body.type != "alias.grant") {
            throw "expect a token 'alias.grant'";
        }

        const rev = await grants.getGrantRevocation(grant);
        if (rev) {
            throw "revoked";
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

    const grantHash = chain.fold(grant).base64();
    const pushURL = grant.body.contract.client.body.pushURL + grantHash;

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

    return res.json({status: 'ok', grantID: grantHash, processor: allProcess});
}));

app.use('/', express.static('static'))

sodium.ready.then(() => {
    const listenPort = config.http.listenPort || 8080;

    app.listen(listenPort, () => console.log(`Listening on port ${listenPort}!`))
});
