Vue.component('verb', {
    props: ['value'],
    data: () => { return {}; },
    template: `
<span v-if="value"><b style="text-transform: uppercase;"><slot></slot></b></span><span v-else-if="!value"><b style="text-transform: uppercase;"><slot></slot> NOT</b></span>
`,
});

var vue = null;

function cbReturnError(contract, error, desc, uri) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = contract.client.body.redirectURL + "?";
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

    //console.log("redirect to", url);
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

    const scopesByBase = {contractual: [], consent: [], legitimate: []};
    for (const scope of contract.scopes) {
        if (!scopesByBase[scope.base]) {
            console.error(`unknown scope base: ${scope.base}`);
            continue;
        }

        scope.agree = true;
        scopesByBase[scope.base].push(scope);
    }

    for (const scope of scopesByBase.consent) {
        scope.agree = false;
    }

    vue = new Vue({
        el: "#popup",
        data: {
            c: contract,
            cId: chain.fold(contract).base64(),
            scopes: scopesByBase,
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
                const finalScopes = [];
                for (const scopes of Object.values(this.scopes)) {
                    for (const scope of scopes) {
                        if (scope.agree) {
                            delete scope.agree;
                            finalScopes.push(scope);
                        }
                    }
                }

                const url = new URL(window.location.href);
                const frontURL = url.origin + "/process/";

                let grant = {
                    type: "alias.grant",
                    contract: contract,//chain.fold(contract),
                    scopes: finalScopes,
                };
                grant = chain.sign(idty.sign, grant);

                console.log(chain.toJSON(grant));

                $.ajax({
                    method: 'POST',
                    url: "/api/grant/new",
                    data: chain.toToken(grant),
                    contentType: "application/json",
                }).then((r) => {
                    //cbProcessReturn(client, grant);
                    cbReturn(contract, grant, idty.bind);
                });
            },
            deny: function() {
                cbReturnError(contract, "access_denied");
            },
        }
    });

    $("#popup").show();
};


