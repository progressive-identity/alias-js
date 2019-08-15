const vue = new Vue({
    el: "#vue",
    data: {
        view: null,
        client: null,
        formatScope: formatScope,
    },
    methods: {
        revokeGrant: function(grant) {
            const grantFold = chain.fold(grant).base64();
            let url = "/revoke/?";
            url = url + "grant=" + encodeURIComponent(chain.toToken(grant));
            window.location.href = url;
        }
    },
});

function run() {
    const clientID = (new URL(window.location.href)).searchParams.get('client');

    $.ajax("/api/view/client/" + clientID).then((r) => {
        vue.view = r.view;
        vue.client = r.client;

    }).catch((e) => {
        switch (e.status) {
            case 404:
                vue.client = false;
                break;
            case 401:
                window.location.href = "/login";
                break;
        };
    });
};

