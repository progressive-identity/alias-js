var vue = null;

function bytesEq(a, b) {
    // XXX TODO
    return sodium.to_base64(a) == sodium.to_base64(b);
}

function cbReturnError(grant, error, desc, uri) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    url = grant.body.client.body.redirectURL + "?";
    url = url + "error=" + encodeURIComponent(error);
    if (desc)  url = url + "&error_description=" + encodeURIComponent(desc);
    if (uri)   url = url + "&error_uri=" + encodeURIComponent(uri);
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbReturn(grant) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = grant.body.client.body.redirectURL + "?";
    url = url + "code=" + encodeURIComponent(chain.toToken(grant));
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function run() {
(async () => {
    const selfUrl = new URL(window.location.href);
    if (!currentUserSeed()) {
        const pathname = url.pathname + url.search;
        window.location.href = "/login/?redirect=" + encodeURIComponent(pathname);
    }

    const code = selfUrl.searchParams.get('code');
    let grant = chain.fromToken(code);

    let vue = new Vue({
        el: "#popup",
        data: {
            grant: grant,
            state: "Configuring processor...",
            progress: null,
            showAdvanced: false,
        },
        methods: {
            toggleAdvanced: function() {
                this.showAdvanced = !this.showAdvanced;
            },
        },
    });

    let inp = null;

    {
        const gdriveToken = openBox().gdrive.token;
        const l = await gDriveList(gdriveToken, {
            q: "name contains 'takeout-' and (name contains '.zip' or name contains '.tgz')",
            spaces: "drive",
            fields: 'nextPageToken, files(id, size)',
            orderBy: 'modifiedTime desc',
        });
        const f = l.files[0];

        inp = gDriveDownloadRequest(gdriveToken, f.id, f.size);
        console.log(inp);
    }

    inp = { url: "http://172.21.0.1:8080/dump-my_activity.tgz" };

    const processorInp = {
        inp: [ inp ],
        client_url: grant.body.client.body.chain_url,
        scopes: [
            ["google", "myactivity.assistant", null, ["audioFiles", "time", "title"]],
            //["google", "myactivity.search", null, null]
        ],
    };

    const ws = new WebSocket('ws://processor.authz.gdpr.dev.local/');
    ws.addEventListener('open', (e) => {
        vue.state = "Queued...";
        vue.progress = null;
        ws.send(JSON.stringify(processorInp));
    });
    ws.addEventListener('close', (e) => {
        if (e.code != 1000) {
            vue.state = `Processing raised an error and stopped! (error ${e.code})`;
            vue.progress = null;
            return;
        }

        vue.state = "Finished";
        vue.progress = 100.0;

        cbReturn(grant);
    });
    ws.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);

        if (data.init) {
            vue.state = "Starting";
            vue.progress = 0.0;
        } else if (data.progress) {
            vue.state = "Processing";
            vue.progress = Math.floor(data.progress * 100.0);
        } else if (data.outs) {
            console.log(data.outs);
            ws.close();
        }
    });

    $("#popup").show();
})();
};
