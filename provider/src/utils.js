const headerAPIKey = "X-Alias-APIKey";
const headerPublicKey = "X-Alias-PublicKey";

function authed(req, res, next) {
    let publicKey = null;

    if (!publicKey &&
        config.authentication &&
        config.authentication.session &&
        req.session.publicKey) {
        publicKey = chain.fromJSON(req.session.publicKey);
    }

    if (!publicKey &&
        config.authentication &&
        config.authentication.apikey &&
        req.header(headerAPIKey) == config.authentication.apikey &&
        req.header(headerPublicKey)) {

        const publicKeyBase64 = req.header(headerPublicKey);

        try {
            publicKey = sodium.from_base64(req.header(headerPublicKey));
        } catch (e) {
            return res.status(400).send({"status": "error", "reason": `bad publickey via ${headerPublicKey}`});
        }
    }

    if (!publicKey) {
        return res.status(401).send({"status": "error", "reason": "unauthorized"});
    }

    req.alias = req.alias || {};
    req.alias.publicKey = publicKey;
    next();
}

const asyncMiddleware = fn =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    }
;

function groupBy(o, cb) {
    const r = {};
    for (const v in o) {
        const k = cb(v);
        r[k] = r[k] || [];
        r[k].push(v);
    }
    return r;
}

function isSafeRedirection(type, url) {
    const whitelist = config.redirection[type];

    if (!whitelist) {
        return false;
    }

    for (const re of whitelist) {
        if (url.match(new RegExp(re))) {
            return true;
        }
    }

    return false;
}

module.exports.asyncMiddleware = asyncMiddleware;
module.exports.authed = authed;
module.exports.groupBy = groupBy;
module.exports.isSafeRedirection = isSafeRedirection;
