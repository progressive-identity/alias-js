function authed(req, res, next) {
    const publicKey = req.session.publicKey;
    if (!publicKey) {
        return res.status(401).send({"status": "error", "reason": "unauthorized"});
    }

    req.alias = req.alias || {};
    req.alias.publicKey = chain.fromJSON(publicKey);
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

module.exports.asyncMiddleware = asyncMiddleware;
module.exports.authed = authed;
module.exports.groupBy = groupBy;
