const PublicSalt = new Uint8Array([120, 91, 218, 28, 75, 140, 142, 94, 53, 23, 72, 39, 190, 221, 210, 152]);

const chain = new Anychain({
    passwordSalt: PublicSalt,
});

let _publicSeed = null;
function publicSeed() {
    if (_publicSeed == null) {
        const root = "sample alias authorization app";
        _publicSeed = sodium.crypto_generichash(64, sodium.from_string(root));
    }

    return _publicSeed;
}

function userSecretSeed(user, password) {
    const pwdSeed = chain.seedOf(user, 16, publicSeed());
    return chain.passwordSeed(password, pwdSeed);
}

function userPublicPassHash(user, password) {
    const pwdSeed = chain.seedOf(user, 16, publicSeed(), "public");
    return chain.passwordSeed(password, pwdSeed);
}

function createIdentity() {
    return {
        seed: chain.seed(),
        sign: chain.signKeypair(),
    }
}

function saveBox(user, passHash, box) {
    return $.ajax({
        method: 'PUT',
        url: '/alias/user',
        headers: {
            'Authorization': "Basic " + btoa(user + ":" + sodium.to_base64(passHash)),
        },
        data: {
            box: box,
        }
    });
}

function getBox(user, passHash) {
    return $.ajax({
        method: 'GET',
        url: '/alias/user',
        headers: {
            'Authorization': "Basic " + btoa(user + ":" + sodium.to_base64(passHash)),
        },
    });
}

function deleteBox(user, passHash) {
    return $.ajax({
        method: 'DELETE',
        url: '/alias/user',
        headers: {
            'Authorization': "Basic " + btoa(user + ":" + sodium.to_base64(passHash)),
        },
    });
}

function mutateIdentity(sess, cb) {
    const idty = openBox(sess.box, sess.userSeed);
    cb(idty);
    const box = sealBox(idty, sess.userSeed);
    return saveBox(sess.username, sess.passHash, box)
        .then(() => {
            sess.box = box;
            setSession(sess.username, sess.userSeed, sess.passHash, sess.box);
        })
    ;
}

function sealBox(idty, userSeed) {
    const sk = chain.boxSeedKeypair(chain.seedOf(userSeed, 32, "box"));
    const box = chain.seal(sk.publicKey, idty);
    return chain.toToken(box);
}

function openBox(boxToken, userSeed) {
    const sk = chain.boxSeedKeypair(chain.seedOf(userSeed, 32, "box"));
    const box = chain.fromToken(boxToken);
    const idty = chain.sealOpen(sk, box);
    return idty;
}

function setSession(username, userSeed, passHash, box) {
    sessionStorage.setItem("alias", chain.toToken({
        username: username,
        userSeed: userSeed,
        passHash: passHash,
        box: box,
    }));
}

function currentSession() {
    let sess = sessionStorage.getItem("alias");
    if (!sess) {
        return null;
    }

    return chain.fromToken(sess);
}

function clearSession() {
    sessionStorage.removeItem("alias");
}

function logout() {
    clearSession();
    window.location.reload();
}

async function gDriveList(token, args, cb) {
    return await $.ajax({
        method: 'POST',
        url: '/api/gdrive/list',
        data: {
            token: token,
            args: args,
        }
    });
}

function gDriveDownloadRequest(token, fileId, size) {
    return {
        url: "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
        args: {
            headers: {
                'Authorization': 'Bearer ' + token.access_token,
            },
            size: parseInt(size),
        },
    }
}

