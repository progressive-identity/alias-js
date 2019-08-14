$("#create_account form").on("submit", () => {
    const username = $("#create_account input[type=text]").val();
    const passInput = $("#create_account input[type=password]");
    const pwd = passInput.val();
    passInput.val("");

    const userSeed = userSecretSeed(username, pwd);
    const passHash = userPublicPassHash(username, pwd);

    const idty = createIdentity(username);
    const box = sealBox(idty, userSeed);
    saveBox(username, passHash, box)
        .catch(() => {
            alert("you cannot create an account with this username");
        })
        .then(() => {
            setSession(username, userSeed, passHash, box);

            return login(idty.sign);
        })
        .then(() => {
            redirect();
        })
    ;

    return false;
});

$("#login form").on("submit", () => {
    const username = $("#login input[type=text]").val();
    const passInput = $("#login input[type=password]");
    const pwd = passInput.val();
    passInput.val("");

    const passHash = userPublicPassHash(username, pwd);

    getBox(username, passHash)
        .catch((_) => {
            alert("unknown user or bad password");
        })
        .then((box) => {
            const userSeed = userSecretSeed(username, pwd);
            const idty = openBox(box, userSeed);
            setSession(username, userSeed, passHash, box);
            return login(idty.sign);
        })
        .then(() => {
            redirect();
        })
    ;

    return false;
});

function redirect() {
    const url = new URL(window.location.href);
    const redirect = url.searchParams.get('redirect') || '/';
    //console.log(url.origin + redirect);
    window.location.href = url.origin + redirect;
}

function run() {
    if (currentSession()) {
        //return redirect();
    }

    $("#create_account").show();
};

