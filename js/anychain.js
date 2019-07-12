const alias_rs = require("./alias_rs.js")

let hash = alias_rs.hash;
const uInt8ArrayTag = '__UInt8Array';
const hashTag = '__hash';

function toPretty(obj) {
    if (obj == null) {
        return null;
    } else if (Array.isArray(obj)) {
        return obj.map(toPretty);
    } else if (typeof(obj) == "object") {
        if (obj.constructor == Uint8Array) {
            return "base64:" + Alias.sodium.to_base64(obj);
        } else {
            let r = {};
            for (let k in obj) {
                let v = obj[k];

                k = toPretty(k);
                v = toPretty(v);

                r[k] = v;
            }

            return r;
        }
    } else {
        return obj;
    }
}

function toJSON(obj) {
    if (obj == null) {
        return null;
    } else if (Array.isArray(obj)) {
        return obj.map(toJSON);
    } else if (typeof(obj) == "object") {
        if (obj.constructor == Uint8Array) {
            let r = {};
            r[uInt8ArrayTag] = Alias.sodium.to_base64(obj);
            return r;
        } else if (obj.constructor == Alias.HashWrapper) {
            let r = {};
            r[hashTag] = obj.as_hash().as_base64();
            return r;

        } else {
            let r = {};
            for (let k in obj) {
                let v = obj[k];

                k = toJSON(k);
                v = toJSON(v);

                r[k] = v;
            }

            return r;
        }
    } else {
        return obj;
    }
}

function fromJSON(obj) {
    if (obj == null) {
        return null;
    } else if (Array.isArray(obj)) {
        return obj.map(fromJSON);
    } else if (typeof(obj) == "object") {
        if (Object.keys(obj).length == 1 && typeof(obj[uInt8ArrayTag]) == 'string') {
            return Alias.sodium.from_base64(obj[uInt8ArrayTag]);
        } else if (Object.keys(obj).length == 1 && typeof(obj[hashTag]) == 'string') {
            let h = alias_rs.Hash.from_base64(obj[hashTag]);
            return new Alias.HashWrapper(h);
        } else {
            let r = {};
            for (let k in obj) {
                let v = obj[k];

                k = fromJSON(k);
                v = fromJSON(v);

                r[k] = v;
            }

            return r;
        }
    } else {
        return obj;
    }
}

function sign(sk, obj) {
    const pk = alias_rs.ed25519_into_public(sk);
    const date = (new Date()).toUTCString();

    const objSignature = {
        type: 'presig',
        date: date,
        signer: pk,
        body: obj,
    };

    let sig = alias_rs.ed25519_sign(sk, hash(objSignature));

    return {
        type: 'sig',
        signature: sig,
        signer: pk,
        date: date,
        body: obj,
    };
}

function isSignature(obj) {
    return obj.type == 'sig' && 'signature' in obj && 'signer' in obj && 'date' in obj && 'body' in obj;
}

function verify(obj) {
    if (!isSignature(obj)) {
        throw "not a signature";
    }

    const objSignature = {
        type: 'presig',
        date: obj.date,
        signer: obj.signer,
        body: obj.body,
    };

    alias_rs.ed25519_verify(obj.signer, hash(objSignature), obj.signature);

    // XXX check date
}

function fold(obj) {
    return new Alias.HashWrapper(hash(obj));
}

module.exports.hash = hash;
module.exports.sign = sign;
module.exports.verify = verify;
module.exports.toPretty = toPretty;
module.exports.toJSON = toJSON;
module.exports.fromJSON = fromJSON;
module.exports.fold = fold;
