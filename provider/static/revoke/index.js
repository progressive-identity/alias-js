var vue = null;

async function run() {
    await authed();

    const {userSeed, box} = currentSession();
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

    const hash = chain.fold(grant).base64();
    const scopes = await $.ajax(`/api/grant/${hash}/scopes`);

    const contract = grant.body.contract;

    vue = new Vue({
        el: "#popup",
        data: {
            grant: grant,
            scopes: scopes,
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
                    method: 'DELETE',
                    url: "/api/grant/",
                    data: chain.toToken(revoke),
                    contentType: "application/json",
                }).then((r) => {
                    window.location.href = "/home/";
                });
            },
            cancel: function() {
                window.history.go(-1);
            },
        }
    });

    $("#popup").show();
};


