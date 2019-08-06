const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express()
const listenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 8080;
const _sodium = require('libsodium-wrappers');

const Anychain = require('@alias/anychain');
const chain = new Anychain();

const SEED = "pouet";

app.use(require('body-parser')());

app.use('/', express.static('static'))

app.use('/alias/', cors(), (req, res) => {
    const signSk = chain.signSeedKeypair(chain.seedOf(SEED, 32, "sign"));
    const boxSk = chain.boxSeedKeypair(chain.seedOf(SEED, 32, "box"));

    let o = {
        type: 'alias.client.decl',
        desc: "Teach machines how real people speak.",
        name: "Common Voice",
        legal: {
            usage: "Data will be imported in the public-domain Common Voice database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
            third: [
                "Mozilla.org, and partners involved in the Common Voice project",
            ]
        },
        domain: 'client.gdpr.dev.local',
        redirect_url: 'http://client.gdpr.dev.local/cb/',
        chain_url: 'http://172.21.0.1:8081/files/debug',
        crypto: {
            sign: signSk.publicKey,
            box: boxSk.publicKey,
        }

    };

    o = chain.sign(signSk, o);
    res.send(chain.toJSON(o));
});

(async() => {
    await _sodium.ready;
    global.sodium = _sodium;
    app.listen(listenPort, () => console.log(`Example app listening on port ${listenPort}!`))
})();
