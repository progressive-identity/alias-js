"use strict";

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

function utf8Encode(o) {
    return utf8Encoder.encode(o);
}

function utf8Decode(o) {
    return utf8Decoder.decode(o);
}

const uint8ArrayTag = "__bytes";
const hashTag = "__hash";
const boxTag = "__box";

function blake2b(opt, o) {
    return sodium.crypto_generichash(opt.hashLength, o, opt.key);
}

function blake2bStr(opt, s) {
    return blake2b(opt, utf8Encode(s));
}

function blake2bInit(opt) {
    return sodium.crypto_generichash_init(opt.key, opt.hashLength);
}

function blake2bUpdate(state, o) {
    return sodium.crypto_generichash_update(state, o);
}

function blake2bFinal(opt, state) {
    return sodium.crypto_generichash_final(state, opt.hashLength);
}

/***/

class Hash {
    constructor(raw) {
        this._raw = raw;
    }

    base64() {
        return sodium.to_base64(this._raw);
    }

    hex() {
        return sodium.to_hex(this._raw);
    }
}

class Box {
    constructor(raw) {
        this._raw = raw;
    }

    base64() {
        return sodium.to_base64(this._raw);
    }
}

/***/

function _fold(opt, o) {
    let type = typeof o;

    let h = null;
    if (o == null) {
        h = blake2bStr(opt, "null:null");

    } else if (type == "boolean") {
        if (o) {
            h = blake2bStr(opt, "boolean:true");
        } else {
            h = blake2bStr(opt, "boolean:false");
        }
    } else if (type == "number") {
        h = blake2bStr(opt, "number:" + JSON.stringify(o));

    } else if (type == "string") {
        h = blake2bStr(opt, "string:" + o);

    } else if (type != "object") {
        // pass
        //
    } else if (o.constructor == Uint8Array) {
        let state = blake2bInit(opt);
        blake2bUpdate(state, utf8Encode("bytes:"));
        blake2bUpdate(state, o);
        h = blake2bFinal(opt, state);

    } else if (o.constructor == Hash) {
        h = o._raw;

    } else if (o.constructor == Box) {
        let state = blake2bInit(opt);
        blake2bUpdate(state, utf8Encode("box:"));
        blake2bUpdate(state, o._raw);
        h = blake2bFinal(opt, state);

    } else if (Array.isArray(o)) {
        let state = blake2bInit(opt);
        blake2bUpdate(state, utf8Encode("list:"));
        for (let i in o) {
            let v = o[i];
            blake2bUpdate(state, _fold(opt, v));
        }
        h = blake2bFinal(opt, state);
    } else {
        let stateK = blake2bInit(opt);
        blake2bUpdate(stateK, utf8Encode("keys:"));
        let stateV = blake2bInit(opt);
        blake2bUpdate(stateV, utf8Encode("values:"));

        let entries = Object.entries(o).sort();
        for (let i in entries) {
            let k, v = entries[i];
            blake2bUpdate(stateK, _fold(opt, k));
            blake2bUpdate(stateV, _fold(opt, v));
        }

        let state = blake2bInit(opt);
        blake2bUpdate(state, utf8Encode("dict:"));
        blake2bUpdate(state, blake2bFinal(opt, stateK));
        blake2bUpdate(state, blake2bFinal(opt, stateV));
        h = blake2bFinal(opt, state);
    }

    if (h == null) {
        throw "unhashable value: " + o;
    }

    return h;
}

function fold(opt, o) {
    return new Hash(_fold(opt, o));
}

function sign(opt, sk, o) {
    const date = (new Date()).toUTCString();

    const sig = {
        type: 'anychain.signature',
        date: date,
        signer: sk.publicKey,
        body: o,
    };

    sig.signature = sodium.crypto_sign_detached(_fold(opt, sig), sk.privateKey);
    return sig;
}

function revoke(opt, sk, o) {
    if (!isSignature(o)) {
        throw "revoke only signatures";
    }

    if (sk.publicKey != o.signer) {
        throw "bad private key";
    }

    let sigFold = {
        type: o.type,
        date: fold(opt, o.date),
        signer: o.signer,
        signature: o.signature,
        body: fold(opt, o.body),
    };

    const rev = {
        type: 'anychain.revoke',
        signature: sigFold,
    };

    rev.revocation = sodium.crypto_sign_detached(_fold(opt, rev), sk.privateKey);
    return rev;
}


function isSignature(o) {
    return (
        isDict(o) &&
        o.type == "anychain.signature" &&
        "signature" in o &&
        "signer" in o &&
        "date" in o &&
        "body" in o
    );
}

function isRevocation(o) {
    return (
        isDict(o) &&
        o.type == "anychain.revoke" &&
        isSignature(o.signature) &&
        "revocation" in o
    );
}

function isDict(o) {
    return (
        typeof(o) == "object" &&
        o.constructor != Uint8Array &&
        o.constructor != Hash &&
        o.constructor != Box
    );
}

function verify(opt, o) {
    if (isSignature(o)) {
        const sig = {
            type: o.type,
            date: o.date,
            signer: o.signer,
            body: o.body,
        };

        const ok = sodium.crypto_sign_verify_detached(o.signature, _fold(opt, sig), o.signer);
        if (!ok) {
            throw "invalid signature";
        }

        // TODO check dates are coherent
    } else if (isRevocation(o)) {
        const rev = {
            type: o.type,
            signature: o.signature,
        };

        const ok = sodium.crypto_sign_verify_detached(o.revocation, _fold(opt, rev), o.signature.signer);
        if (!ok) {
            throw "invalid revocation";
        }
    }

    if (Array.isArray(o)) {
        o.forEach((v) => verify(opt, v));
    } else if (isDict(o)) {
        for (const k in o) {
            verify(opt, k);
            verify(opt, o[k]);
        }
    }
}

function fromJSON(o) {
    if (o == null) {
        return null;
    } else if (Array.isArray(o)) {
        return o.map(fromJSON);
    } else if (typeof(o) == "object") {
        if (Object.keys(o).length == 1 && typeof(o[uint8ArrayTag]) == 'string') {
            return sodium.from_base64(o[uint8ArrayTag]);

        } else if (Object.keys(o).length == 1 && typeof(o[hashTag]) == 'string') {
            return new Hash(sodium.from_base64(o[hashTag]));

        } else if (Object.keys(o).length == 1 && typeof(o[boxTag]) == 'string') {
            return new Box(sodium.from_base64(o[boxTag]));

        } else {
            let r = {};
            for (let k in o) {
                let v = o[k];

                k = fromJSON(k);
                v = fromJSON(v);

                r[k] = v;
            }

            return r;
        }
    } else {
        return o;
    }
}

function toJSON(o) {
    if (o == null) {
        return null;
    } else if (Array.isArray(o)) {
        return o.map(toJSON);
    } else if (typeof(o) == "object") {
        if (o.constructor == Uint8Array) {
            let r = {};
            r[uint8ArrayTag] = sodium.to_base64(o);
            return r;

        } else if (o.constructor == Hash) {
            let r = {};
            r[hashTag] = sodium.to_base64(o._raw);
            return r;

        } else if (o.constructor == Box) {
            let r = {};
            r[boxTag] = sodium.to_base64(o._raw);
            return r;

        } else {
            let r = {};
            for (let k in o) {
                let v = o[k];

                k = toJSON(k);
                v = toJSON(v);

                r[k] = v;
            }

            return r;
        }
    } else {
        return o;
    }
}

function seal(opt, pk, o) {
    let oJSON = JSON.stringify(toJSON(o));

    const box = sodium.crypto_box_seal(oJSON, pk);
    return new Box(box);
}

function sealOpen(opt, sk, o) {
    let r = sodium.crypto_box_seal_open(o._raw, sk.publicKey, sk.privateKey);
    r = utf8Decode(r);
    r = JSON.parse(r);
    return fromJSON(r);
}

function seedOf(opt, args) {
    if (args.length < 3) {
        throw "Anychain.seedOf(rootSeed, length, path, [to, [seed, [...]]])"
    }

    let seed = args[0];
    let length = args[1];
    for (let i=2; i<args.length; ++i) {
        const isLast = args.length - 1 == i;
        let key = args[i];
        let pathH = sodium.crypto_generichash(64, key, opt.key);
        seed = sodium.crypto_generichash(isLast ? length : 64, seed, opt.key);
    }

    return seed;
};

function passwordSeed(pwd, salt) {
    return sodium.crypto_pwhash(
        64,
        pwd,
        salt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
    );
}

function validate(opt, o, validator) {
    if (Array.isArray(o)) {
        o.forEach((v) => validate(opt, v, validator));
    } else if (isDict(o)) {
        for (const k in o) {
            validate(opt, k, validator);
            validate(opt, o[k], validator);
        }
    }

    if (isSignature(o)) {
        validator(o);
    }
}

(function() {
    var Anychain = (function() {
        var Anychain = function(options) {
            this.options = options || {};

            if (!('hashLength' in this.options)) this.options.hashLength = 64;
            if (!('key' in this.options)) this.options.key = null;
        };

        Anychain.prototype.fold = function(o) {
            return fold(this.options, o);
        };;

        Anychain.prototype.signKeypair = function() {
            return sodium.crypto_sign_keypair();
        };

        Anychain.prototype.signSeedKeypair = function(seed) {
            return sodium.crypto_sign_seed_keypair(seed);
        };

        Anychain.prototype.sign = function(sk, o) {
            return sign(this.options, sk, o);
        };

        Anychain.prototype.toJSON = function(o) {
            return toJSON(o);
        };

        Anychain.prototype.fromJSON = function(o) {
            return fromJSON(o);
        };

        Anychain.prototype.toToken = function(o) {
            return JSON.stringify(toJSON(o));
        };

        Anychain.prototype.fromToken = function(code) {
            return fromJSON(JSON.parse(code));
        };

        Anychain.prototype.verify = function(o) {
            return verify(this.options, o);
        };

        Anychain.prototype.boxKeypair = function() {
            return sodium.crypto_box_keypair();
        };

        Anychain.prototype.boxSeedKeypair = function(seed) {
            return sodium.crypto_box_seed_keypair(seed);
        };

        Anychain.prototype.seal = function(pk, o) {
            return seal(this.options, pk, o);
        };

        Anychain.prototype.sealOpen = function(sk, o) {
            return sealOpen(this.options, sk, o);
        };

        Anychain.prototype.seed = function(sz) {
            sz = sz || 64;
            return sodium.randombytes_buf(sz);
        };

        Anychain.prototype.seedOf = function() {
            return seedOf(this.options, arguments);
        };

        Anychain.prototype.passwordSeed = function(pwd, salt) {
            return passwordSeed(pwd, salt);
        };

        Anychain.prototype.validate = function(o, validator) {
            return validate(this.options, o, validator);
        };

        Anychain.prototype.revoke = function(sk, o) {
            return revoke(this.options, sk, o);
        };

        return Anychain;
    })();


    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined')
        module.exports = Anychain;
    else
        window.Anychain = Anychain;
})();
