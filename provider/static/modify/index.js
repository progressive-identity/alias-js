Vue.component('verb', {
    props: ['value'],
    data: () => { return {}; },
    template: `
<span v-if="value"><b style="text-transform: uppercase;"><slot></slot></b></span><span v-else-if="!value"><b style="text-transform: uppercase;"><slot></slot> NOT</b></span>
`,
});

var vue = null;

function deepcloneJSON(x) {
    return JSON.parse(JSON.stringify(x));
}

function getContractCallbackURL(contract) {
    const network = contract.network || {};
    const scheme = network.scheme || "https";
    const domain = contract.client.body.domain;
    const endpoint = network.redirectEndpoint || "/alias/cb/";
    if (endpoint.charAt(0) != "/") { throw "bad endpoint"; }
    const url = `${scheme}://${domain}${endpoint}`;
    return url;
}

function cbReturnError(contract, error, desc, uri) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = getContractCallbackURL(contract) + "?";
    url = url + "error=" + encodeURIComponent(error);
    if (desc)  url = url + "&error_description=" + encodeURIComponent(desc);
    if (uri)   url = url + "&error_uri=" + encodeURIComponent(uri);
    if (state) url = url + "&state=" + encodeURIComponent(state);

    window.location.href = url;
}

function cbReturn(contract, grant, bind) {
    const state = (new URL(window.location.href)).searchParams.get('state');

    let url = getContractCallbackURL(contract) + "?";
    url = url + "code=" + encodeURIComponent(chain.toToken(grant));
    url = url + "&bind=" + encodeURIComponent(chain.toToken(bind));
    if (state) url = url + "&state=" + encodeURIComponent(state);

    //console.log("redirect to", url);
    window.location.href = url;
}

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

        if (!chain.isSignature(grant, "alias.grant")) {
            throw "not a grant";
        }

    } catch(e) {
        alert(`ERROR: invalid grant: ${e}`);
        return;
    };

    const contract = grant.body.contract;
    const hasContractual = contract.base.contractual && contract.base.contractual.scopes.length != 0 && contract.base.contractual.usages.length != 0;
    const hasConsent = contract.base.consent && contract.base.consent.length != 0;
    const hasLegitimate = contract.base.legitimate && contract.base.legitimate.groups.length != 0;

    const draftBase = deepcloneJSON(grant.body.base);

    function newGrant(revoked, base) {
        let grant = {
            type: "alias.grant",
            contract: contract,
            revoked: revoked,
        };

        if (!revoked) {
            grant.base = base;
        }

        grant = chain.sign(idty.sign, grant);
        console.log(grant);

        $.ajax({
            method: 'POST',
            url: '/api/contract/grant',
            data: chain.toToken(grant),
            contentType: "application/json",
        }).then((r) => {
            window.location.href = "/home/";
        })
    }

    vue = new Vue({
        el: "#popup",
        data: {
            c: contract,
            base: draftBase,
            hasConsent: hasConsent,
            hasContractual: hasContractual,
            hasLegitimate: hasLegitimate,
            showAdvanced: false,
        },
        methods: {
            toggleAdvanced: function() {
                this.showAdvanced = !this.showAdvanced;
            },
            saveChanges: function() {
                newGrant(false, this.base);
            },
            revoke: function() {
                newGrant(true, null);
            },
        }
    });

    $("#popup").show();
};


