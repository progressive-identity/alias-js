$("#clear_identity").on("click", function() {
    const resp = prompt("This action CANNOT be undone. Type 'yes' if you are sure.");

    if (resp != "yes") {
        return;
    }

    const sess = currentSession();
    $.ajax({
        method: "POST",
        url: "/api/session/clear"
    }).then(() => {
        deleteBox(sess.username, sess.passHash).then(logout);
        window.location.href = "/login/";
    });

    return false;
});

$("#link_gdrive").on("click", function() {
    window.location.href = "/api/storage/gdrive/link/";
});

$("#logout").on("click", () => {
    logout();
});

function doLogin() {
    const {userSeed, box} = currentSession();
    let idty = openBox(box, userSeed);
    login(idty.sign);
}

function run() {
    const sess = currentSession();

    if (!sess) {
        window.location.href = "/login/";
        return;
    }

    const {userSeed, box} = sess;

    $("#identity").show();

    {
        let idty = openBox(box, userSeed);
        $("#username").text(idty.username);
        $("#box").html(JSON.stringify(chain.toJSON(idty), null, 2));
    }

    $("#dumps").show();

    $.ajax("/api/storage/dumps").then((r) => {
        $("#dumps ul").empty();
        for (let provider in r) {
            for (let file of r[provider]) {
                $("#dumps ul").append(
                    '<li>' + file.provider + ': <a href="' + file.webViewLink + '" target="_blank" ><code>' + file.name + "</code></a> (" + file.modifiedTime + ")</li>"
                );
            }
        }
    });
};

