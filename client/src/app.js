const express = require('express');
const fs = require('fs');
const listenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 80;
const _sodium = require('libsodium-wrappers');
const AliasClient = require('./aliasClient.js');

(async() => {
    await _sodium.ready;
    global.sodium = _sodium;

    const client = new AliasClient({
        secretSeed: "pouet",

        domain: "client.gdpr.dev.local",
        scheme: 'http',
        redirectURL: "http://client.gdpr.dev.local/cb/",

        //domain: "localhost:8080",
        name: "Common Voice",
        desc: "Teach machines how real people speak.",

        onNewPush: (grant) => {
            console.log("NEW GRANT", chain.toJSON(grant));
        },
    });

    const contract = client.generateContract({
        scopes: [
            {
                provider: "google",
                path: "my_activity.assistant",
                predicates: [
                    [ "has", "audioFiles" ],
                ],
            },
            {
                provider: "foo",
                path: "bar",
                consent: true,
            }
        ],
        legal: {
            usage: "Data will be imported in the public-domain Common Voice database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
            third: [
                "Mozilla.org, and partners involved in the Common Voice project",
            ]
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

    app.put('/alias/push/', (req, res) => {
        console.log("push");
        res.json({});
    });

    app.use('/', express.static('static'));
    app.listen(listenPort, () => console.log(`Example app listening on port ${listenPort}!`))

})();
