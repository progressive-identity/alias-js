#!/usr/bin/env node

const Anychain = require('@alias/anychain');

(async function() {
    await sodium.ready;

    const chain = new Anychain();

    const k = chain.signSeedKeypair(chain.seed(32));
    const tok = chain.toToken(k);

    console.log(tok);
})();
