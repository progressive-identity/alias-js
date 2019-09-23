global.fetch = require('node-fetch');
const express = require('express');
const publicListenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 80;
const privateListenPort = parseInt(process.env.ALIAS_CLIENT_PORT) || 3000;
const AliasClient = require('./aliasClient.js');
const {asyncMiddleware} = require('./utils.js');

// initialize the public express app
const publicApp = express()
publicApp.use(require('morgan')('tiny'));
publicApp.use(require('body-parser')());
publicApp.use(require('body-parser').raw({
    inflate: true,
    limit: '64mb',
    type: 'application/octet-stream'
}));

const privateApp = express()
privateApp.use(require('morgan')('tiny'));
privateApp.use(require('body-parser')());
privateApp.use(require('body-parser').raw({
    inflate: true,
    limit: '64mb',
    type: 'application/octet-stream'
}));


chain.ready.then(() => {
    // initialize new client
    const client = new AliasClient();

    // register a callback to be called when a new grant is being pushed
    client.on('push', (grant) => {
        console.log("NEW GRANT", chain.toJSON(grant));
    });

    publicApp.use(client.publicRouter);
    privateApp.use(client.privateRouter);

    // XXX DEBUG
    publicApp.use(client.privateRouter);

    publicApp.use('/', express.static('static'));
    publicApp.listen(publicListenPort, () => console.log(`public service listening on port ${publicListenPort}!`))
    privateApp.listen(privateListenPort, () => console.log(`private service listening on port ${privateListenPort}!`))

});
