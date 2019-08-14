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

function createIdentity(username) {
    let idty = {
        username: username,
        seed: chain.seed(),
        sign: chain.signKeypair(),
    };

    const selfURL = new URL(window.location.href);

    let bind = {
        type: "alias.bindAuthz",
        domain: selfURL.hostname,
    };
    idty.bind = chain.sign(idty.sign, bind);

    return idty;
}

function saveBox(user, passHash, box) {
    return $.ajax({
        method: 'PUT',
        url: '/api/user',
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
        url: '/api/user',
        headers: {
            'Authorization': "Basic " + btoa(user + ":" + sodium.to_base64(passHash)),
        },
    });
}

function deleteBox(user, passHash) {
    return $.ajax({
        method: 'DELETE',
        url: '/api/user',
        headers: {
            'Authorization': "Basic " + btoa(user + ":" + sodium.to_base64(passHash)),
        },
    });
}

function login(sk) {
    return $.ajax("/api/session/seed")
        .then((r) => {
            r = chain.fromJSON(r);
            r = chain.sign(sk, r);
            return $.ajax({
                method: "POST",
                url: "/api/session/login",
                data: chain.toJSON(r),
            });
        })
        .then((r) => {
            console.log(r);
        })
    ;
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
    $.ajax({
        method: 'POST',
        url: '/api/session/logout'
    }).then(() => {
        clearSession();
        window.location.reload();
    });
}

function formatScope(scope) {
    let r = scope.provider + "." + scope.path;

    if (scope.predicates) {
        const formatPredicates = (scope.predicates).map((p) => {
            if (p.length == 2) {
                return p[0] + p[1];
            } else if (p.length == 3) {
                return p[1] + p[0] + p[2];
            } else {
                return "?";
            }
        });

        r = r + "[" + formatPredicates.join(",") + "]";
    }

    if (scope.fields) {
        r = r + ".{" + scope.fields.join(",") + "}";
    } else {
        r = r + ".*";
    }

    return r;
}
