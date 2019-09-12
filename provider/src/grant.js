const express = require('express');
const router = express.Router();
const {authed} = require('./utils.js');
const redis = require('./redis.js');
const history = require('./history.js');

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

    redis.db.pipeline()
        .hset(
            redis.key("user", req.alias.publicKey, "grants"),
            grantHash,
            chain.toToken(grant)
        )
        .lpush(redis.key("user", req.alias.publicKey, "history"), chain.toToken(grant))
        .exec()
        .then(() => {
            res.json({});
        })
    ;
});

async function propagateRevocation(publicKey, grantHash) {
    let grant = await redis.db.hget(redis.key("user", publicKey, "grants"), grantHash);
    grant = chain.fromToken(grant);
    const pushURL = grant.body.contract.client.body.pushURL + grantHash;

    await fetch(pushURL, {
        method: 'PUT',
        body: chain.toToken(grant),
        headers: {
            "Content-Type": "application/json",
        }
    })

    await fetch(pushURL, {
        method: 'POST',
        body: {"finished": true},
    });
}

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

    propagateRevocation(req.alias.publicKey, grantHash)
        .then(() => {
            return redis.db.pipeline()
            .hdel(
                redis.key("user", req.alias.publicKey, "grants"),
                grantHash,
            )
            .hset(
                redis.key("user", req.alias.publicKey, "revs"),
                grantHash,
                chain.toToken(revoke),
            )
            .lpush(redis.key("user", req.alias.publicKey, "history"), chain.toToken(revoke))
            .exec();
        })
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
