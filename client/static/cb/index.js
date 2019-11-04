const chain = new Anychain.Chain();
chain.registerValidator(AliasChains.validators);

function run() { (async () => {
    let data = {data: null};

    const selfUrl = new URL(window.location.href);

    data.error = selfUrl.searchParams.get('error');
    if (data.error) {
        data.title = "👎 Grant denied";

    } else {
        const grantToken = selfUrl.searchParams.get('code');
        const bindToken = selfUrl.searchParams.get('bind');

        try {
            data.grant = chain.fromToken(grantToken);
            data.bind = chain.fromToken(bindToken);

            data.forged = false;
            data.title = "👍 Granted";
        } catch(e) {
            data.forged = true;
            data.title = "🛑 token is forged";
        }

        if (!data.forged) {
            data.contract = data.grant.body.contract;
            data.grantHash = chain.fold(data.grant).base64();
            data.contractHash = chain.fold(data.contract).base64();
            data.grantJSON = chain.toJSON(data.grant);
            data.scopes = AliasChains.getGrantScopes(data.grant);
            data.niceGrantDate = new Date(data.grant.date);
            data.fileURL = (fn) => `/alias/contract/${data.contractHash}/data/${fn}`;

            await $.ajax({
                method: 'POST',
                url: '/alias/grant',
                data: {
                    grant: grantToken,
                    bind: bindToken,
                }
            });
        }
    }

    data.dataError = null;
    data.refresh = (force) => {
        const method = force ? 'POST' : 'GET';
        vue.data = null;
        vue.dataError = null;
        $.ajax({
            method: method,
            url: '/alias/contract/' + data.contractHash + "/data/",
        }).then((r) => {
            vue.data = r;
        }).catch((r) => {
            vue.data = null;
            switch (r.readyState) {
            case 4: vue.dataError = "alias error: " + r.responseJSON.reason; break;
            case 5: vue.dataError = "server error"; break;
            };
        });
    };

    let vue = new Vue({
        el: "#body",
        data: data,
    });


    if (!data.error && !data.forged) {
        data.refresh();
    }

})(); }

