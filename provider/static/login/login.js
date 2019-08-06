$("#create_account form").on("submit", () => {
    const input = $("#create_account input[type=password]");
    let pwh = calculatePwh(input.val());
    input.val("");

    var currentHost = new URL(window.location.href).host;

    setBox(pwh, createBox());
    login(pwh);
    console.log(openBox(pwh));

    redirect();
    return false;
});

$("#login form").on("submit", () => {
    const input = $("#login input[type=password]");
    let pwh = calculatePwh(input.val());

    try {
        login(pwh);
    } catch {
        alert("bad password");
        return false;
    }

    redirect();
    return false;
});

function redirect() {
    const url = new URL(window.location.href);
    const redirect = url.searchParams.get('redirect');
    window.location.href = url.origin + redirect;
}

function run() {
    let pwh = loadIdentity();

    if (Identity) {
        return redirect();
    }

    if (hasBox()) {
        $("#login").show();
    }

    $("#create_account").show();
};

