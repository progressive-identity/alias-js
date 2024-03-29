Vue.component('verb', {
    props: ['value'],
    data: () => { return {}; },
    template: `
<span v-if="value"><b style="text-transform: uppercase;"><slot></slot></b></span><span v-else-if="!value"><b style="text-transform: uppercase;"><slot></slot> NOT</b></span>
`,
});

Vue.component('grant-usages-scopes', {
    props: ['value', 'descmap'],
    data: () => { return {}; },
    template: `
        <div>
            <p>Usages: <ul>
                <li v-for="usage in value.usages">{{ usage }}</li>
            </ul></p>
            <p>Scopes: <ul>
                <li v-for="scope in value.scopes"><alias-scope :value="scope" :descmap="descmap"></alias-scope></li>
            </ul></p>
        </div>
    `,
});

async function run() {
    /*
    const sess = currentSession();
    if (!sess) {
        window.location.href = "/login/";
        return;
    }
    const {userSeed, box} = sess;
    const idty = openBox(box, userSeed);
    */

    const code = (new URL(window.location.href)).searchParams.get('code');
    const o = chain.fromToken(code);

    // request description for each scopes mentionned in the contract
    const scopes = AliasChains.getContractScopes(o.body.contract);
    const scopeDescs = await describeScopes(scopes);
    const scopeId = scopes.map(s => chain.fold(s).base64());
    const scopeDescByIds = {};
    for (const i in scopes) {
        scopeDescByIds[chain.fold(scopes[i]).base64()] = scopeDescs[i];
    }

    const vue = new Vue({
        el: "#vue",
        data: {
            id: chain.fold(o).base64(),
            o: o,
            scopeDescByIds: scopeDescByIds,
        },
        methods: {
            toJSON: (o) => chain.toJSON(o),
            orderID: (o) => chain.fold(o).base64(),
            toBase64: (v) => sodium.to_base64(v),
            hasContractContractualBase: (c) => c.base && c.base.contractual && c.base.contractual.usages && c.base.contractual.usages.length > 0,
            hasContractConsentBase: (c) => c.base && c.base.consent && c.base.consent.length > 0,
            hasContractLegitimateBase: (c) => c.base && c.base.legitimate && c.base.legitimate.groups && c.base.legitimate.groups.length > 0,
        },
    });
};

