const express = require('express');
const router = express.Router();
const {authed, asyncMiddleware} = require('./utils.js');
const redis = require('./redis.js');
const history = require('./history.js');
const aliasChains = require('./aliasChains.js');

async function getGrants(publicKey) {
    const grantTokens = await redis.db.hgetall(redis.key("user", publicKey, "contracts"));
    const grants = {};
    for (const contractHash in grantTokens) {
        grants[contractHash] = chain.fromSafeToken(grantTokens[contractHash]);
    }
    return grants;
}

async function getGrantByContractHash(publicKey, contractHash) {
    let grant = await redis.db.hget(redis.key("user", publicKey, "contracts"), contractHash);
    grant = chain.fromSafeToken(grant);
    return grant;
}

async function updateGrant(grant) {
    const publicKey = sodium.to_base64(grant.signer);
    const contractHash = chain.fold(grant.body.contract).base64();

    const contractsRedisKey = redis.key("user", publicKey, "contracts");

    // if we have a known grant which is revoked or in the future, ignore
    // current grant
    const knownGrant = await getGrantByContractHash(publicKey, contractHash);
    if (!aliasChains.isGrantNewer(knownGrant, grant)) {
        return knownGrant;
    }

    await redis.db.pipeline()
        .hset(
            redis.key("user", publicKey, "contracts"),
            contractHash,
            chain.toToken(grant)
        )
        .lpush(redis.key("user", publicKey, "history"), chain.toToken(grant))
        .exec()

    return grant;
}

function getContractPushURL(contract) {
    const contractHash = chain.fold(contract).base64();
    const network = contract.network || {};
    const scheme = network.scheme || 'https';
    const domain = contract.client.body.domain;
    const pushEndpoint = network.pushEndpoint || '/alias/push/';
    return `${scheme}://${domain}${pushEndpoint}${contractHash}`;
}

router.get('/', authed, asyncMiddleware(async (req, res) => {
    const contractHashes = await redis.db.hkeys(redis.key("user", req.alias.publicKey, "contracts"));

    res.json({
        status: "ok",
        result: contractHashes,
    });
}));

router.get('/:contractHash', authed, asyncMiddleware(async (req, res) => {
    const grant = await getGrantByContractHash(req.alias.publicKey, req.params.contractHash);

    console.log(chain.fold(grant.body.contract).base64());

    if (grant == null) {
        return res.status(404).json(null);
    }

    res.json(chain.toJSON(grant));
}))

router.get('/:contractHash/scopes', authed, asyncMiddleware(async (req, res) => {
    const grant = await getGrantByContractHash(req.alias.publicKey, req.params.contractHash);

    if (grant == null) {
        return res.status(404).json(null);
    }

    const scopes = aliasChains.getGrantScopes(grant);
    res.json(scopes);
}));

router.post('/grant', authed, asyncMiddleware(async (req, res) => {
    try {
        var grant = chain.fromJSON(req.body);

        if (grant.type != "anychain.signature" && grant.body.type != "alias.grant") {
            throw "not a grant";
        }

        if (sodium.to_base64(grant.signer) != sodium.to_base64(req.alias.publicKey)) {
            throw "grant is not signed by authenticated user";
        }
    } catch(e) {
        console.error(e);
        return res.status(400).json({status: "error", reason: e});
    }

    await updateGrant(grant);
    res.json({});
}));

async function propagateGrant(publicKey, grant) {
    console.error("XXX propagateGrant");
    throw "XXX";

    const updated = await updateGrant(publicKey, grant);
    if (!updated) {
        return;
    }

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

module.exports.getGrants = getGrants;
module.exports.getContractPushURL = getContractPushURL;
module.exports.updateGrant = updateGrant;
module.exports.router = router;
