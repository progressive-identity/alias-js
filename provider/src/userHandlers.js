const express = require('express');
const app = express.Router();
const redis = require('./redis.js');

async function getAccountBox(username, publicPwdHash) {
    const accountJSON = await redis.db.hget(redis.key("account"), username);

    if (accountJSON == null) {
        return null;
    }

    const account = JSON.parse(accountJSON);
    if (account.publicPwdHash != publicPwdHash) {
        throw "bad password";
    }

    return account.box;
}

async function setAccountBox(username, publicPwdHash, box, create) {
    const currentBox = await getAccountBox(username, publicPwdHash);
    if (currentBox && create) {
        throw "account already exists";
    }

    if (!currentBox && !create) {
        throw "account does not exist";
    }

    const account = {
        box: box,
        publicPwdHash: publicPwdHash,

    };

    await redis.db.hset(redis.key("account"), username, JSON.stringify(account));
}

async function deleteAccountBox(username) {
    const removed = await redis.db.hdel(redis.key("account"), username);
    return !!removed;
}

const userBasicAuth = require('express-basic-auth')({
    authorizer: (username, publicPwdHash, cb) => {
        getAccountBox(username, publicPwdHash).then(
            (v) => cb(null, true),
            (e) => cb(null, false),
        );
    },
    authorizeAsync: true,
});

app.get('/', userBasicAuth, (req, res) => {
    getAccountBox(req.auth.user, req.auth.password).then((v) => {
        if(v) {
            res.send(v);
        } else {
            res.status(404).send();
        }
    });
});

app.put('/', userBasicAuth, (req, res) => {
    if (!req.body.box) {
        return res.status(400).send({status: 'error', reason: 'missing arguments'});
    }

    setAccountBox(req.auth.user, req.auth.password, req.body.box, false)
        .then(
            () => res.status(200).send({status: "ok"}),
            (e) => res.status(400).send({status: "error", reason: e})
        )
    ;
});

app.post('/', (req, res) => {
    if (!req.body.box || !req.body.username || !req.body.publicPwdHash) {
        return res.status(400).send({status: 'error', reason: 'missing arguments'});
    }

    setAccountBox(req.body.username, req.body.publicPwdHash, req.body.box, true)
        .then(
            () => res.status(200).send({status: "ok"}),
            (e) => res.status(400).send({status: "error", reason: e})
        )
    ;
});

app.delete('/', userBasicAuth, (req, res) => {
    deleteAccountBox(req.auth.user, req.auth.password).then((wasDeleted) => {
        if (wasDeleted) {
            res.status(200).send({status: "ok"})
        } else {
            res.status(404).send({status: "error"});
        }
    });
});

module.exports = app;
