const express = require('express');
const fs = require('fs');
const listenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 8080;
const _sodium = require('libsodium-wrappers');
const AliasClient = require('./aliasClient.js');

const client = new AliasClient({
    secretSeed: "pouet",

    domain: "client.gdpr.dev.local",
    scheme: 'http',
    redirectURL: "http://client.gdpr.dev.local/cb/",

    //domain: "localhost:8080",
    name: "Common Voice",
    desc: "Teach machines how real people speak.",
    legal: {
        usage: "Data will be imported in the public-domain Common Voice database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
        third: [
            "Mozilla.org, and partners involved in the Common Voice project",
        ]
    },
});

console.log(client.clientId);

const app = express()
app.use(require('body-parser')());
app.use(client.router);

(async() => {
    await _sodium.ready;
    global.sodium = _sodium;


    app.use('/', express.static('static'));
    app.listen(listenPort, () => console.log(`Example app listening on port ${listenPort}!`))
})();
