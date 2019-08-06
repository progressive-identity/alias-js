const PublicSalt = new Uint8Array([120, 91, 218, 28, 75, 140, 142, 94, 53, 23, 72, 39, 190, 221, 210, 152]);

var Identity = null;

function calculatePwh(password) {
    return sodium.crypto_pwhash(
        32,
        password,
        PublicSalt,
        sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE, sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
        sodium.crypto_pwhash_ALG_DEFAULT
    );
}

function hasBox() {
    return localStorage.getItem("box") != null;
}

function openBox(pwh) {
    let box = localStorage.getItem("box");
    if (!box) {
        return null;
    }

    let {publicKey, privateKey} = sodium.crypto_box_seed_keypair(pwh);
    let arr = sodium.crypto_box_seal_open(sodium.from_base64(box), publicKey, privateKey);
    let obj = JSON.parse(sodium.to_string(arr));
    return obj;
}

function seedOf(/*rootSeed, length, path...*/) {
    if (arguments.length < 3) {
        throw "seedOf(rootSeed, length, path, [to, [seed, [...]]])"
    }

    let seed = arguments[0];
    let length = arguments[1];
    for (let i=2; i<arguments.length; ++i) {
        const isLast = arguments.length - 1 == i;
        let key = JSON.stringify(arguments[i]);
        let pathH = sodium.crypto_generichash(64, key);
        seed = sodium.crypto_generichash(isLast ? length : 64, seed);
    }

    return seed;
}

function setBox(pwh, obj) {
    let {publicKey} = sodium.crypto_box_seed_keypair(pwh);
    let box = sodium.crypto_box_seal(JSON.stringify(obj), publicKey);
    this.localStorage.setItem("box", sodium.to_base64(box));
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
