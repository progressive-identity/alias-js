$("#create_account form").on("submit", () => {
    const username = $("#create_account_username").val();
    const email = $("#create_account_email").val();
    const passInput = $("#create_account input[type=password]");
    const pwd = passInput.val();
    passInput.val("");

    if (username.length == 0 || email.length == 0 || pwd.length == 0) {
        alert("please fill every fields");
        return false;
    }

    createAccount(username, pwd)
        .then((idty) => console.log("idty", idty))
        .then(() => redirect())
        .catch(() => alert("you cannot create an account with this username"))
    ;

    return false;
});

$("#login form").on("submit", () => {
    const username = $("#login input[type=text]").val();
    const passInput = $("#login input[type=password]");
    const pwd = passInput.val();
    passInput.val("");

    loginAccount(username, pwd)
        .then(() => redirect())
        .catch((e) => alert(e))
    ;

    return false;
});

function redirect() {
    const url = new URL(window.location.href);
    const redirect = url.searchParams.get('redirect') || '/home/';
    //console.log(url.origin + redirect);
    window.location.href = url.origin + redirect;
}

function run() {
    if (currentSession()) {
        //return redirect();
    }

    $("#create_account").show();
};

