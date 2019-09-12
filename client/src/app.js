global.fetch = require('node-fetch');
const express = require('express');
const fs = require('fs');
const listenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 80;
const _sodium = require('libsodium-wrappers');
const AliasClient = require('./aliasClient.js');
const {asyncMiddleware} = require('./utils.js');

(async() => {
    await _sodium.ready;
    global.sodium = _sodium;

    const client = new AliasClient({
        secretSeed: "pouet",

        domain: "client.gdpr.dev.local",
        url: "http://client.gdpr.dev.local/",
        scheme: 'http',
        redirectURL: "http://client.gdpr.dev.local/cb/",

        //domain: "localhost:8080",
        name: "VoiceLabs",
        desc: "Teach machines how real people speak.",
        url: "https://voicelabs.co/",
        company: "VoiceLabs Inc",

        onNewPush: (grant) => {
            console.log("NEW GRANT", chain.toJSON(grant));
        },
    });

    const contract = client.generateContract({
        scopes: [
            {
                base: "consent",
                provider: "google",
                path: "my_activity.assistant",
                predicates: [
                    [ "has", "audioFiles" ],
                ],
            },
            {
                base: "consent",
                provider: "amazon",
                path: "alexa",
            },
        ],
        legal: {
            usage: "Data will be imported in the public-domain VoiceLabs database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
            accept_users_right_access_modify_transfer_delete: true,
            automated_decision: false,
            automated_surveillance: false,
            destination: [
              "Snips Inc",
              "Voxist",
              "Voicelow",
              "Roger Voice",
            ],
            email_dpo: "dpo@voicelabs.co",
            evaluation_notation_rating_profiling: false,
            innovative_reasonable_expectations: false,
            mixing_reasonable_expectations: false,
            subprocessors: [],
            tos_url: "https://voicelabs.co/tos/",
            transfer_outside_eea: false,
        },
    });

    const app = express()
    app.use(require('morgan')('tiny'));
    app.use(require('body-parser')());
    app.use(require('body-parser').raw({
        inflate: true,
        limit: '64mb',
        //limit: '100kb',
        type: 'application/octet-stream'
    }));

    app.use(client.router);
    app.get("/alias/contract/common_voice", (req, res) => {
        res.send(chain.toJSON(contract));
    });
    app.use("/api/grant/:grantHash/", asyncMiddleware(async (req, res, next) => {
        const force = req.method == 'POST';
        try {
                await client.fetch(req.params.grantHash, {
                force: force,
            });
        } catch(e) {
            res.status(404).json({status: "error", reason: e});
        }
        const rootPath = client.getDataPath(req.params.grantHash);
        //return express.static(rootPath)(req, res, next);

        const basePath = decodeURIComponent(req.originalUrl.substr(req.baseUrl.length)); // XXX TODO this is dirty

        const filePath = client.getFilePath(req.params.grantHash, basePath);
        const fileStat = await fs.promises.lstat(filePath);
        if (fileStat.isDirectory()) {
            const r = await client.browse(req.params.grantHash, basePath);
            res.json({status: "ok", "resources": r});
        } else {
            const fh = fs.createReadStream(filePath);
            res.setHeader("content-type", require("mime").lookup(filePath));
            fh.pipe(res);
        }
    }));

    app.use('/', express.static('static'));
    app.listen(listenPort, () => console.log(`Listening on port ${listenPort}!`))

})();
