var vue = null;

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
        var grant = chain.fromToken(url.searchParams.get('grant'));

        if (!isSignature(grant) || grant.body.type !== "alias.grant") {
            throw "not a grant";
        }
    } catch(e) {
        cbReturnError(client, "unauthorized_client");
    };

    const contract = grant.body.contract;

    vue = new Vue({
        el: "#popup",
        data: {
            grant: grant,
            formatScope: formatScope,
        },
        methods: {
            revoke: function() {
                let revoke = {
                    type: "alias.revokeGrant",
                    grant: chain.fold(grant),
                }
                revoke = chain.sign(idty.sign, revoke);

                $.ajax({
                    method: 'POST',
                    url: "/api/grant/revoke",
                    data: chain.toToken(revoke),
                    contentType: "application/json",
                }).then((r) => {
                    window.location.href = "/";
                });
            },
            cancel: function() {
                window.history.go(-1);
            },
        }
    });

    $("#popup").show();
};


