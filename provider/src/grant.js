const express = require('express');
const router = express.Router();
const {authed, asyncMiddleware} = require('./utils.js');
const redis = require('./redis.js');
const history = require('./history.js');

async function getGrantHashes(publicKey) {
    const grantHashes = await redis.db.hkeys(redis.key("user", publicKey, "grants"));
    return grantHashes;
}

async function getGrants(publicKey) {
    const grantTokens = await redis.db.hgetall(redis.key("user", publicKey, "grants"));
    const grants = {};
    for (let k in grantTokens) {
        grants[k] = chain.fromSafeToken(grantTokens[k]);
    }
    return grants;
}

async function getGrant(publicKey, hash) {
    let grant = await redis.db.hget(redis.key("user", publicKey, "grants"), hash);
    grant = chain.fromSafeToken(grant);
    return grant;
}

async function getGrantRevocation(grant) {
    const publicKey = grant.signer;
    const grantHash = chain.fold(grant).base64();

    const rev = await redis.db.hget(redis.key("user", grant.signer, "revs"), grantHash);
    return rev;
}

function getGrantPushURL(grant) {
    const grantHash = chain.fold(grant).base64();
    const network = grant.body.contract.network || {};
    const scheme = network.scheme || 'https';
    const domain = grant.body.contract.client.body.domain;
    const pushEndpoint = network.pushEndpoint || '/alias/push/';
    return `${scheme}://${domain}${pushEndpoint}${grantHash}`;
}

function getGrantScopes(grant) {
    const base = grant.body.contract.base;
    const scopeById = {};

    function add(scope) {
        const scopeId = chain.fold(scope).base64();
        scopeById[scopeId] = scope;
    }

    // contractual base
    if (base.contractual && base.contractual.scopes) {
        base.contractual.scopes.forEach(add);
    }
    // legitimate
    if (base.legitimate && base.legitimate.groups) {
        for (const group of base.legitimate.groups) {
            group.scopes.forEach(add);
        }
    }

    // consent
    if (base.consent) {
        for (const groupIdx in base.consent) {
            for (const scopeIdx in base.consent[groupIdx].scopes) {
                if (grant.body.consent[groupIdx][scopeIdx]) {
                    add(base.consent[groupIdx].scopes[scopeIdx]);
                }
            }
        }
    }

    return Object.values(scopeById);
}

router.get('/', authed, asyncMiddleware(async (req, res) => {
    const grantHashes = await getGrantHashes(req.alias.publicKey);

    res.json({
        status: "ok",
        result: grantHashes,
    });
}));

router.get('/:grantHash', authed, asyncMiddleware(async (req, res) => {
    const grant = await getGrant(req.alias.publicKey, req.params.grantHash);

    if (grant == null) {
        return res.status(404).json(null);
    }

    res.json(chain.toJSON(grant));
}));

router.get('/:grantHash/scopes', authed, asyncMiddleware(async (req, res) => {
    const grant = await getGrant(req.alias.publicKey, req.params.grantHash);

    if (grant == null) {
        return res.status(400).json(null);
    }

    const scopes = getGrantScopes(grant);
    res.json(scopes);
}));

router.post('/', authed, (req, res) => {
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
    const pushURL = getGrantPushURL(grant);

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

router.delete('/', authed, (req, res) => {
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

module.exports.getGrants = getGrants;
module.exports.getGrantRevocation = getGrantRevocation;
module.exports.getGrantScopes = getGrantScopes;
module.exports.getGrantPushURL = getGrantPushURL;
module.exports.router = router;
