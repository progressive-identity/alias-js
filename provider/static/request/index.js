var vue = null;

function cbReturnError(contract, error, desc, uri) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    url = contract.client.body.redirectURL + "?";
    url = url + "error=" + encodeURIComponent(error);
    if (desc)  url = url + "&error_description=" + encodeURIComponent(desc);
    if (uri)   url = url + "&error_uri=" + encodeURIComponent(uri);
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbReturn(contract, grant, bind) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = contract.client.body.redirectURL + "?";
    url = url + "code=" + encodeURIComponent(chain.toToken(grant));
    url = url + "&bind=" + encodeURIComponent(chain.toToken(bind));
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbProcessReturn(contract, grant) {
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

    // check contract
    try {
        var contract = chain.fromToken(url.searchParams.get('contract'));

        chain.validate(contract, (o) => {
            if (o.body.type == 'alias.client.decl') {
                if (!sodium.memcmp(o.body.crypto.sign, o.signer)) {
                    throw "bad client declaration: bad signer";
                }
            }
        });
    } catch(e) {
        cbReturnError(client, "unauthorized_client");
    };

    const scopes = contract.scopes.filter((scope) => !scope.consent);
    const consentScopes = contract.scopes.filter((scope) => scope.consent);

    let consent = [];
    consent.length = consentScopes.length;
    consent.fill(false);

    vue = new Vue({
        el: "#popup",
        data: {
            c: contract,
            cId: chain.fold(contract).base64(),
            scopes: scopes,
            consentScopes: consentScopes,
            consent: consent,
            userPublicKey: sodium.to_base64(selfPublicKey),
            clientSignerH: sodium.to_base64(contract.client.signer),
            showAdvanced: false,
            formatScope: formatScope,
        },
        methods: {
            toggleAdvanced: function() {
                this.showAdvanced = !this.showAdvanced;
            },
            agree: function() {
                let scopes = [...this.scopes];
                for (let i in this.consentScopes) {
                    if (this.consent[i]) {
                        scopes.push(this.consentScopes[i]);
                    }
                }

                const url = new URL(window.location.href);
                const frontURL = url.origin + "/process/";

                let grant = {
                    type: "alias.grant",
                    contract: contract,//chain.fold(contract),
                    scopes: scopes,
                };
                grant = chain.sign(idty.sign, grant);
                //cbProcessReturn(client, grant);
                cbReturn(contract, grant, idty.bind);
            },
            deny: function() {
                cbReturnError(contract, "access_denied");
            },
        }
    });

    $("#popup").show();
};


