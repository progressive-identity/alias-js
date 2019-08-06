const PublicSalt = new Uint8Array([120, 91, 218, 28, 75, 140, 142, 94, 53, 23, 72, 39, 190, 221, 210, 152]);

const chain = new Anychain({
    passwordSalt: PublicSalt,
});

var Identity = null;

function calculatePwh(password) {
    return chain.passwordSeed(password);
}

function hasBox() {
    return localStorage.getItem("box") != null;
}

function createBox() {
    return {
        seed: chain.seed(),
        sign: chain.signKeypair(),
    }
}

function openBox(pwh) {
    pwh = pwh || currentPwh();
    if (!pwh) {
        throw "no password hash given";
    }

    let box = localStorage.getItem("box");
    if (!box) {
        return null;
    }
    box = chain.fromToken(box);

    const sk = chain.boxSeedKeypair(chain.seedOf(pwh, 32, "box"));
    //alert(JSON.stringify(box));
    obj = chain.sealOpen(sk, box);
    return obj;
}

function setBox(pwh, obj) {
    const sk = chain.boxSeedKeypair(chain.seedOf(pwh, 32, "box"));
    const box = chain.seal(sk.publicKey, obj);
    localStorage.setItem("box", chain.toToken(box));
}

function mutateBox(pwh, cb) {
    let box = openBox(pwh);
    cb(box);
    setBox(pwh, box);
}

function login(pwh) {
    openBox(pwh);    // XXX
    sessionStorage.setItem("pwh", sodium.to_base64(pwh));
}

function logout() {
    sessionStorage.removeItem("pwh");
    window.location.reload();
}

function clearIdentity() {
    sessionStorage.removeItem("pwh");
    localStorage.removeItem("box");
    window.location.reload();
}

function currentPwh() {
    let pwh = sessionStorage.getItem("pwh");
    if (!pwh) {
        return null;
    }

    return sodium.from_base64(pwh);
}

function loadIdentity() {
    let pwh = currentPwh();

    if (pwh) {
        try {
            Identity = openBox(pwh);
        } catch(er) {
            console.error(er);
            pwh = null;
        }
    }

    return pwh;
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

