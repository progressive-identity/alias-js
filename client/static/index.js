$("#clear_identity").on("click", function() {
    clearIdentity();
});

$("#link_gdrive").on("click", function() {
    window.location.href = "/api/gdrive/link/";
});

$("#logout").on("click", () => {
    logout();
});

function run() {
    let pwh = loadIdentity();

    if (Identity) {
        $("#identity").show();
        $("#box").html(JSON.stringify(openBox(pwh), null, 2));
        $("#dumps").show();

        const box = openBox(pwh);
        if (box.gdrive) {
            gDriveList(box.gdrive.token, {
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

    } else {
        window.location.href = "/login/?redirect=%2f";
    }
};

