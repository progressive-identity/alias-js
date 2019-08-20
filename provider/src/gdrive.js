const express = require('express');
const fs = require('fs');
const router = express.Router();
const {google} = require('googleapis');
const {authed} = require('./utils.js');
const redis = require('./redis.js');

function getToken(publicKey) {
    return redis.db.hget(redis.key("user", publicKey), "gdrive").then(JSON.parse);
}

function setToken(publicKey, token) {
    return redis.db.hset(
        redis.key("user", publicKey),
        "gdrive",
        JSON.stringify(token)
    );
}

function oauth2Client(publicKey, token) {
    const {client_secret, client_id, redirect_uris} = config.storage.gdrive.web;
    const client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (token) {
        client.setCredentials(token);

        client.on('tokens', (tokens) => {
            console.log("GDRIVE RENEW TOKENS");
            if (tokens.refresh_token) {
                token.refresh_token = tokens.refresh_token;
            }

            token.access_token = tokens.access_token;
            token.expiry_date = tokens.expiry_date;
            token.scope = tokens.scope;
            token.token_type = tokens.token_type;

            setToken(publicKey, token);
        });
    }

    return client;
}

function gdriveClient(publicKey, token) {
    const auth = oauth2Client(publicKey, token);
    return google.drive({version: 'v3', auth});
}

router.get('/link', authed, (req, res) => {
    const drive = oauth2Client(req.alias.publicKey, null);
    const authUrl = drive.generateAuthUrl({
        access_type: 'online',
        scope: [
            'https://www.googleapis.com/auth/drive.readonly',
        ]
    });

    res.redirect(authUrl);
});

router.post('/unlink', authed, (req, res) => {
    redis.db.hdel(redis.key("user", req.alias.publicKey), "gdrive").then(() => res.json());
});

router.get('/debug', authed, (req, res) => {
    (async () => {
        let token = await getToken(req.alias.publicKey);
        let auth = oauth2Client(req.alias.publicKey, token);
        const drive = google.drive({version: 'v3', auth});

        const r = await drive.files.list({
            q: "name contains 'takeout-' and (name contains '.zip' or name contains '.tgz')",
            //q: "name contains 'debug'",
            spaces: "drive",
            //fields: 'nextPageToken, files(*)',
            //fields: 'nextPageToken, files(id, name, modifiedTime, size, webViewLink)',
            fields: 'nextPageToken, files(id, name, modifiedTime, size, webViewLink)',
            orderBy: 'modifiedTime desc',
        });

        res.json(r);
    })();
});

router.get('/cb', authed, (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send({error: "no code"});
    }

    console.log(code);

    oauth2Client(req.alias.publicKey, null)
        .getToken(code)
        .then((r) => {
            console.log(r.tokens);
            return setToken(req.alias.publicKey, r.tokens);
        })
        .then(() => {
            res.redirect("/");
        })
        .catch((err) => {
            return res.status(500).send({error: "error", reason: err});
        })
    ;
});

async function listDumps(publicKey) {
    const token = await getToken(publicKey);
    const drive = gdriveClient(publicKey, token);

    const listGoogleTakeouts = drive.files.list({
        q: "name contains 'takeout-' and (name contains '.zip' or name contains '.tgz')",
        //q: "name contains 'debug'",
        spaces: "drive",
        //fields: 'nextPageToken, files(*)',
        //fields: 'nextPageToken, files(id, name, modifiedTime, size, webViewLink)',
        fields: 'nextPageToken, files(id, name, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc',
    });

    /*const listDumps = drive.files.list({
        q: "'Alias' in parents and (name contains '.zip' or name contains '.tgz')",
        spaces: "drive",
        fields: 'nextPageToken, files(*)',
        orderBy: 'modifiedTime desc',
    });*/

    //const r = await Promise.all([listGoogleTakeouts]);
    //const takeouts = r[0];

    const takeouts = await listGoogleTakeouts;

    let fileMapper = function(r) {
        r.source = "gdrive";
        r.size = parseInt(r.size);
        r.rawReqArgs = {
            url: "https://www.googleapis.com/drive/v3/files/" + r.id + "?alt=media",
            headers: {
                "Authorization": "Bearer " + token.access_token,
            },
            size: r.size,
        };

        return r;
    };

    const res = [];
    for (let v of takeouts.data.files) {
        v = fileMapper(v);
        v.provider = "google";
        res.push(v);
    }
    //res.push(...dumps.data.files.map(fileMapper));
    return res;
}

module.exports.router = router;
module.exports.listDumps = listDumps;
