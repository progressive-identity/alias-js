function doLogin() {
    const {userSeed, box} = currentSession();
    let idty = openBox(box, userSeed);
    login(idty.sign);
}

const vue = new Vue({
    el: "#vue",
    data: {
        idty: null,
        storage: null,
        grants: null,
        clients: null,
        view: null,
        history: null,
    },
    methods: {
        orderID: function(o) {
            return chain.fold(o).base64();
        },
        orderToken: function(o) {
            return encodeURIComponent(chain.toToken(o));
        },
        storageLink: function(provider) {
            window.location.href = "/api/storage/" + provider + "/link/";

        },
        storageUnlink: function(provider) {
            const self = this;

            $.ajax({
                method: 'POST',
                url: "/api/storage/" + provider + "/unlink/",
            }).then((r) => {
                // XXX TODO BUG
                self.storage[provider] = false;
            });
        },
        displayClient: function(clientID) {
            window.location.href = "/client/?client=" + clientID;
        },
        revokeClient: function(clientID) {
            window.location.href = "/client/revoke/?client=" + clientID;
        },
        clear_identity: function() {
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
        },
        logout: function() {
            logout();
        },
    },
});

function run() {
    const sess = currentSession();

    if (!sess) {
        window.location.href = "/login/";
        return;
    }

    const {userSeed, box} = sess;

    const idty = openBox(box, userSeed);
    const authzURL = new URL(idty.bind.body.origin);
    console.log(authzURL);
    vue.idty = {
        username: idty.username,
        alias: idty.username + "@" + authzURL.hostname,
        anonymousAlias: sodium.to_hex(idty.bind.signer) + "@" + authzURL.hostname,
        publicKey: sodium.to_base64(idty.sign.publicKey),
    };

    $.ajax("/api/view/index").then((r) => {
        vue.grants = r.grants;
        vue.clients = r.clients;
        vue.view = r.view;
        r.history.push(chain.toJSON(idty.bind));    // XXX
        vue.history = r.history.map((v) => chain.fromJSON(v));
    }).catch((e) => {
        if (e.status == 401) {
            window.location.href = "/login";
        }
    });

    $.ajax("/api/storage/").then((r) => {
        vue.storage = r;
    });

    /*
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
    */
};

