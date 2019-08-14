const express = require('express');
const redis = require('./redis.js');
const {authed} = require('./utils.js');
const gdrive = require('./gdrive.js');

const router = express.Router();

async function getTokens(publicKey) {
    const r = await redis.db.pipeline()
        .hget(redis.key("user", publicKey), "gdrive")
        .hget(redis.key("user", publicKey), "dropbox")
        .exec();

    return {
        gdrive: JSON.parse(r[0][1]),
        dropbox: JSON.parse(r[1][1]),
    }
}

async function getDumps(publicKey) {
    const tokens = await getTokens(publicKey);

    const dumps = [];

    // XXX DEBUG
    if (false) {
        dumps.push({
            provider: "google",
            name: "local google",
            size: 58047624,
            rawReqArgs: {
                url: "http://172.17.0.1:8081/takeout-20190710T135348Z-001.tgz",
            }
        });
    }

    const drive = await gdrive.listDumps(publicKey, tokens.gdrive);
    dumps.push(...drive);

    const r = {};
    for (let d of dumps) {
        r[d.provider] = r[d.provider] || [];
        r[d.provider].push(d);
    }

    return r;
    // XXX add more provider
}

router.get('/tokens', authed, (req, res) => {
    getTokens(req.alias.publicKey).then((r) => {
        res.status(200).send(r);
    });
});

router.get('/dumps', authed, (req, res) => {
    getDumps(req.alias.publicKey).then((r) => {
        res.status(200).send(r);
    })
    .catch((err) => { res.status(500).send({status: "error", reason: err}); });
});

router.use("/gdrive", gdrive.router);

module.exports.getDumps = getDumps;
module.exports.router = router;

