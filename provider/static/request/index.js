var vue = null;

function cbReturnError(client, error, desc, uri) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    url = client.body.redirectURL + "?";
    url = url + "error=" + encodeURIComponent(error);
    if (desc)  url = url + "&error_description=" + encodeURIComponent(desc);
    if (uri)   url = url + "&error_uri=" + encodeURIComponent(uri);
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbReturn(client, grant, bind) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = client.body.redirectURL + "?";
    url = url + "code=" + encodeURIComponent(chain.toToken(grant));
    url = url + "&bind=" + encodeURIComponent(chain.toToken(bind));
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbProcessReturn(client, grant) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = grant.body.fetch.frontURL + "?";
    url = url + "code=" + encodeURIComponent(chain.toToken(grant));
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function run() {
    const sess = currentSession();

    if (!sess) {
        const url = new URL(window.location.href);
        const pathname = url.pathname + url.search;
        window.location.href = "/login/?redirect=" + encodeURIComponent(pathname);
        return;
    }

    const {userSeed, box} = sess;
    const idty = openBox(box, userSeed);

    const selfPublicKey = idty.sign.publicKey;
    if (!selfPublicKey) { throw "no sign publicKey set"; }

    const url = new URL(window.location.href);
    const clientId = url.searchParams.get('client_id');

    const allScopes = url.searchParams.get('scopes').split(' ');
    const scopes = allScopes.filter((s) => !s.startsWith('?'));
    const consentScopes = allScopes.filter((s) => s.startsWith('?')).map((s) => s.substr(1));
    let consent = [];
    consent.length = consentScopes.length;
    consent.fill(false);

    $.ajax(clientId)
        .catch(() => {
            alert("invalid client");
        })
        .then((r) => {
            let client = null;
            try {
                client = chain.fromJSON(r);
                chain.verify(client);
                if (client.body.type != 'alias.client.decl') {
                    throw "bad client declaration";
                }

                chain.validate(client, (o) => {
                    if (o.body.type == 'alias.client.decl') {
                        if (!sodium.memcmp(o.body.crypto.sign, o.signer)) {
                            throw "bad client declaration: bad signer";
                        }
                    }
                });
            } catch(e) {
                console.error(e);
                cbReturnError(client, "unauthorized_client");
            }

            return client;
        })
        .then((client) => {
            vue = new Vue({
                el: "#popup",
                data: {
                    client: client,
                    clientH: chain.fold(client).base64(),
                    scopes: scopes,
                    consentScopes: consentScopes,
                    consent: consent,
                    userPublicKey: sodium.to_base64(selfPublicKey),
                    clientSignerH: sodium.to_base64(client.signer),
                    showAdvanced: false,
                },
                methods: {
                    toggleAdvanced: function() {
                        this.showAdvanced = !this.showAdvanced;
                    },
                    agree: function() {
                        let scopes = [...this.scopes];
                        for (let i in this.consentScopes) {
                            if (this.consent[i]) {
                                scopes.push("?" + this.consentScopes[i]);
                            }
                        }

                        const url = new URL(window.location.href);
                        const frontURL = url.origin + "/process/";

                        let grant = {
                            type: "alias.grant",
                            scopes: scopes,
                            client: chain.fold(client),
                        };
                        grant = chain.sign(idty.sign, grant);
                        //cbProcessReturn(client, grant);
                        cbReturn(client, grant, idty.bind);
                    },
                    deny: function() {
                        cbReturnError(client, "access_denied");
                    },
                }
            });
            $("#popup").show();
        })
        .catch(() => {
            alert("something went wrong");
            // XXX cb error
        })
    ;
};


