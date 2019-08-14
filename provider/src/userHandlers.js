const express = require('express');
const app = express.Router();
const userDb = require('./userdb.js');

const userBasicAuth = require('express-basic-auth')({
    authorizer: (username, pwd, cb) => {
        userDb.get(username, pwd).then(
            (v) => cb(null, true),
            (e) => cb(null, false)
        );
    },
    authorizeAsync: true,
});

app.get('/', userBasicAuth, (req, res) => {
    userDb.get(req.auth.user, req.auth.password).then((v) => {
        if(v) {
            res.send(v);
        } else {
            res.status(404).send();
        }
    });
});

app.put('/', userBasicAuth, (req, res) => {
    const box = req.body.box;
    if (!box) {
        return res.status(400).send();
    }

    userDb.put(req.auth.user, req.auth.password, box).then(() => res.send());
});

app.delete('/', userBasicAuth, (req, res) => {
    userDb.del(req.auth.user, req.auth.password).then((wasDeleted) => {
        if (wasDeleted) {
            res.send()
        } else {
            res.status(404).send();
        }
    });
});

module.exports = app;
