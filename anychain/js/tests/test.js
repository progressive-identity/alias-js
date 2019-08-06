const _sodium = require('libsodium-wrappers');
const Anychain = require('../anychain.js');

function validator(o) {
    if (o.body.type == 'alias.client.decl') {
        if (o.body.crypto.signer.body.publicKey != o.signer) {
            throw "bad client declaration: bad signer";
        }
    }
}

(async () => {
    await _sodium.ready;
    global.sodium = _sodium;

    let a = new Anychain();
    let sk = a.signKeypair();
    const uid = a.seed();

    let subk = a.signKeypair();
    let osubk = {
        type: 'alias.subkey',
        publicKey: subk.publicKey,
    };
    osubk = a.sign(sk, osubk);

    let boxk = a.boxKeypair();
    let o = {
        type: 'alias.client.decl',
        uid: uid,
        desc: "Teach machines how real people speak.",
        name: "Common Voice",
        legal: {
            usage: "Data will be imported in the public-domain Common Voice database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
            third: [
                "Mozilla.org, and partners involved in the Common Voice project",
            ]
        },
        redirect_uri: 'http://client.alias/alias/cb',
        crypto: {
            signer: osubk,
            box: boxk.publicKey,
        }
    };
    o = a.sign(subk, o);

    a.verify(o);
    a.validate(validator, o);

    //console.log(JSON.stringify(a.toJSON(o), null, 4));

    let skUser = a.signKeypair();
    let res = a.sign(skUser, { hey: true, previous: a.fold(o), hidden: a.seal(boxk.publicKey, 42)});

    //console.log(a.toJSON(res));

    const rev = a.revoke(subk, o);
    a.verify(rev);
    //console.log(a.toJSON(rev));

})();
