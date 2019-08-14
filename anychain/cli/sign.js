#!/usr/bin/env node

const Anychain = require('@alias/anychain');

(async function() {
    await sodium.ready;

    const fs = require('fs');

    const optionDefs = [
        { name: 'key', alias: 'k', type: String },
        { name: 'input', type: String, defaultOption: true },
    ];

    const opts = require('command-line-args')(optionDefs)

    if (!opts.key) {
        console.error("no key defined. Use parameter '--key'");
        return;
    }

    if (!opts.input) {
        console.error("no input defined");
        return;
    }

    const chain = new Anychain();

    const key = chain.fromToken(fs.readFileSync(opts.key, {encoding: 'utf-8'}));
    const inp = chain.fromToken(fs.readFileSync(opts.input, {encoding: 'utf-8'}));

    const out = chain.sign(key, inp);
    const outTok = chain.toToken(out);

    console.log(outTok);
})();

