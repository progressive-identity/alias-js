function authed(req, res, next) {
    const publicKey = req.session.publicKey;
    if (!publicKey) {
        return res.status(401).send({"status": "error", "reason": "unauthorized"});
    }

    req.alias = req.alias || {};
    req.alias.publicKey = chain.fromJSON(publicKey);
    next();
}

module.exports.authed = authed;
