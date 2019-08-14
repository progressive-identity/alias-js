$("#clear_identity").on("click", function() {
    const resp = prompt("This action CANNOT be undone. Type 'yes' if you are sure.");

    if (resp != "yes") {
        return;
    }

    const sess = currentSession();
    deleteBox(sess.username, sess.passHash).then(logout);
});

$("#link_gdrive").on("click", function() {
    window.location.href = "/api/gdrive/link/";
});

$("#logout").on("click", () => {
    logout();
});

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
        if (idty.gdrive) {
            idty.gdrive = chain.fold(idty.gdrive);
        }
        $("#box").html(JSON.stringify(chain.toJSON(idty), null, 2));
    }

    $("#dumps").show();

    const idty = openBox(box, userSeed);
    $("#username").text(idty.username);
    if (idty.gdrive) {
        gDriveList(idty.gdrive.token, {
            q: "name contains 'takeout-' and (name contains '.zip' or name contains '.tgz')",
            //q: "name contains 'debug'",
            spaces: "drive",
            //fields: 'nextPageToken, files(*)',
            //fields: 'nextPageToken, files(id, name, modifiedTime, size, webViewLink)',
            fields: 'nextPageToken, files(*)',
            orderBy: 'modifiedTime desc',
        }).then((res) => {
            $("#dumps ul").empty();
            res.files.forEach((file) => {
                $("#dumps ul").append(
                    '<li>Google: <a href="' + file.webViewLink + '" target="_blank" ><code>' + file.name + "</code></a> (" + file.modifiedTime + ")</li>"
                );
                console.log(file);
            });
        });
    }
};

