const express = require('express');
const router = express.Router();
const {authed} = require('./utils.js');
const redis = require('./redis.js');

async function getGrants(publicKey) {
    const grantTokens = await redis.db.hgetall(redis.key("user", publicKey, "grants"));
    const grants = {};
    for (let k in grantTokens) {
        grants[k] = chain.fromSafeToken(grantTokens[k]);
    }
    return grants;
}

async function getGrantRevocation(grant) {
    const publicKey = grant.signer;
    const grantHash = chain.fold(grant).base64();


    const rev = await redis.db.hget(redis.key("user", grant.signer, "revs"), grantHash);
    return rev;
}

router.post('/new', authed, (req, res) => {
    try {
        var grant = chain.fromJSON(req.body);
        if (!chain.isSignature(grant) || grant.body.type !== "alias.grant") {
            throw "not a grant";
        }
    } catch(e) {
        return res.status(400).json({status: "error", reason: e});
    }

    var grantHash = chain.fold(grant).base64();

    redis.db.hset(
        redis.key("user", req.alias.publicKey, "grants"),
        grantHash,
        chain.toToken(grant)
    ).then(() => {
        res.json({});
    });
});

router.post('/revoke', authed, (req, res) => {
    try {
        var revoke = chain.fromJSON(req.body);
        if (!chain.isSignature(revoke) || revoke.body.type !== "alias.revokeGrant") {
            throw "not a revocation";
        }
    } catch(e) {
        return res.status(400).json({status: "error", reason: e});
    }

    var grantHash = chain.fold(revoke.body.grant).base64();

    redis.db.pipeline()
        .hdel(
            redis.key("user", req.alias.publicKey, "grants"),
            grantHash,
        )
        .hset(
            redis.key("user", req.alias.publicKey, "revs"),
            grantHash,
            chain.toToken(revoke),
        )
        .exec()
        .then(() => {
            res.json({});
        })
    ;
});

router.get('/list', authed, (req, res) => {
    getGrants(req.alias.publicKey).then((r) => res.json(chain.toJSON(r)));
});

module.exports.getGrants = getGrants;
module.exports.getGrantRevocation = getGrantRevocation;
module.exports.router = router;
