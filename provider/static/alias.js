const PublicSalt = new Uint8Array([120, 91, 218, 28, 75, 140, 142, 94, 53, 23, 72, 39, 190, 221, 210, 152]);

const chain = new Anychain.Chain({
    passwordSalt: PublicSalt,
});
chain.registerValidator(AliasChains.validators);

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
    return chain.seedOfPassword(password, pwdSeed);
}

function userPublicPassHash(user, password) {
    const pwdSeed = chain.seedOf(user, 16, publicSeed(), "public");
    return chain.seedOfPassword(password, pwdSeed);
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
        origin: selfURL.origin,
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

function createBox(user, passHash, box) {
    return $.ajax({
        method: 'POST',
        url: '/api/user',
        data: {
            username: user,
            publicPwdHash: sodium.to_base64(passHash),
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
                data: {token: chain.toToken(r)},
            });
        })
        .then((r) => {
            console.log(r);
        })
    ;
}

function redirectLogin() {
    const url = new URL(window.location.href);
    const pathname = url.pathname + url.search;
    window.location.href = "/login/?redirect=" + encodeURIComponent(pathname);
}

function authed() {
    const sess = currentSession();
    if (!sess) {
        redirectLogin();
        return;
    }

    return $.ajax("/api/session")
        .then((r) => { return true; })
        .catch((e) => {
            redirectLogin();
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
    console.log("box", box);
    const idty = chain.unseal(sk, box);
    console.log("idty", idty);
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

function createAccount(username, pwd) {
    if (username.length == 0 || pwd.length == 0) {
        throw "username or pwd is not set";
    }

    const userSeed = userSecretSeed(username, pwd);
    const passHash = userPublicPassHash(username, pwd);

    const idty = createIdentity(username);
    const box = sealBox(idty, userSeed);
    return createBox(username, passHash, box).then(() => {
        setSession(username, userSeed, passHash, box);
        return login(idty.sign);
    }).then(() => {
        return idty;
    })
}

function loginAccount(username, pwd) {
    if (username.length == 0 || pwd.length == 0) {
        throw "username or pwd is not set";
    }

    const passHash = userPublicPassHash(username, pwd);
    return getBox(username, passHash)
        .catch((_) => {
            throw "unknown user or bad password";
        }).then((box) => {
            const userSeed = userSecretSeed(username, pwd);
            const idty = openBox(box, userSeed);
            setSession(username, userSeed, passHash, box);
            return login(idty.sign);
        })
    ;
}

function formatScope(scope) {
    let r = scope.provider + "." + scope.path;

    if (scope.predicates) {
        const formatPredicates = (scope.predicates).map((p) => {
            if (p.length == 2) {
                return p[0] + " " + p[1];
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

function setUserMeta(d) {
    return $.ajax({
        method: 'POST',
        url: '/api/session/meta',
        contentType: 'application/json',
        data: JSON.stringify(d),
    });
}

function getUserMeta() {
    return $.ajax('/api/session/meta');
}

function describeScopes(scopes) {
    const url = "/api/scope/describe/?scopes=" + encodeURIComponent(JSON.stringify(scopes));
    return $.getJSON(url);
}
