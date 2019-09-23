const chain = new Anychain();

function run() { (async () => {
    let data = {data: null};

    const selfUrl = new URL(window.location.href);

    data.error = selfUrl.searchParams.get('error');
    if (data.error) {
        data.title = "👎 Grant denied";

    } else {
        const token = selfUrl.searchParams.get('code');
        const bindToken = selfUrl.searchParams.get('bind');

        data.grant = chain.fromToken(token);
        data.bind = chain.fromToken(bindToken);
        data.grantHash = chain.fold(data.grant).base64();

        try {
            chain.verify(data.grant);
            chain.verify(data.bind);
            data.forged = false;
            data.title = "👍 Granted";
        } catch(e) {
            data.forged = true;
            data.title = "🛑 token is forged";
        }

        if (!data.forged) {
            data.grantJSON = chain.toJSON(data.grant);

            await $.ajax({
                method: 'POST',
                url: '/alias/grant',
                data: {
                    grant: token,
                    bind: bindToken,
                }
            });

            data.fileURL = (fn) => {
                return '/alias/grant/' + data.grantHash + "/data/" + fn;
            };
        }
    }

    data.dataError = null;
    data.refresh = (force) => {
        const method = force ? 'POST' : 'GET';
        vue.data = null;
        vue.dataError = null;
        $.ajax({
            method: method,
            url: '/alias/grant/' + data.grantHash + "/data/",
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

