const chain = new Anychain();

Vue.component("question", {
    props: [
        'optional',
    ],
    template: `
        <span>
            <p><slot></slot>
            <span v-if="optional">(optional)</span>
            </p>
        </span>
`
});

Vue.component("input-text", {
    props: [
        'id',
        'values',
        'optional',
        'change',
    ],
    template: `
        <div class="question">
            <question :optional="optional"><slot></slot></question>
            <input type="text" :id="id" v-model="values[id]" v-on:change="change" />
        </div>
`
});

Vue.component("input-dropdown", {
    props: [
        'id',
        'values',
        'options',
        'change',
    ],
    template: `
        <div class="question">
            <question :optional="optional"><slot></slot></question>
            <select v-model="values[id]" v-on:change="change">
                <option v-for="(option, k) in options" :value="k">{{option}}</option>
            </select>
        </div>
`
});

Vue.component("input-boolean", {
    props: [
        'id',
        'values',
        'optional',
        'change',
    ],
    data: () => { return {
        error: false,
    };},
    template: `
        <div class="question">
            <question :optional="optional"><slot></slot></question>
            <input type="radio" v-model="values[id]" v-bind:value="true" v-on:change="change">yes</input>
            <input type="radio" v-model="values[id]" v-bind:value="false" v-on:change="change">no</input>
        </div>
`
});

Vue.component("input-scopes", {
    props: [
        'id',
        'values',
        'optional',
        'change',
    ],
    data: () => { return {
    };},
    methods: {
        add: function() {
            this.values.scopes.push({});
        },
        remove: function(id) {
            if (id == 0) {
                return;
            }
            this.values.splice(id, 1);
        },

    },
    template: `
        <div class="question">
            <question><slot></slot></question>
            <div class="scope" v-for="scope, id in values[id]">
                {{ id+1 }}.
                <input type="text" id="provider" v-model="scope.provider" v-on:change="change" />
                <input type="text" id="path" v-model="scope.path" v-on:change="change" />
                <span>(<a href="#" v-on:click.prevent="remove(id)">remove</a>)</span>
            </div>
            <span><a href="#" v-on:click.prevent="add()">add scope</a></span>
        </div>
`
});

Vue.component("input-text-list", {
    props: [
        'id',
        'values',
        'optional',
        'change',
    ],
    data: () => { return {

    };},
    methods: {
        add: function() {
            this.values[this.id].push("");
            this.change();
        },
        remove: function(i) {
            this.values[this.id].splice(i, 1);
            this.change();
        }
    },
    template: `
    <div class="question">
        <question :optional="optional"><slot></slot></question>
        <div v-for="e, i in values[id]">
            {{ i+1 }}.
            <input type="text" v-model="values[id][i]" v-on:change="change" />
            <span>(<a href="#" v-on:click="remove(i)">remove</a>)</span>
        </div>
        <a href="#" v-on:click.prevent="add()">add text entry</a>
    </div>
`
});

Vue.component("input-usages-scopes", {
    props: [
        'values',
        'change',
    ],
    data: () => { return { }; },
    template: `
    <div>
         <input-scopes
            :values="values"
            id="scopes"
            :change="change">
            What are the list of scopes under the contractual base?
        </input-scopes>

       <input-text-list
            :values="values"
            id="usages"
            :change="change">
            What are all the usages you will have with this data.
        </input-text-list>
    </div>
    `
});

Vue.component("input-list-usages-scopes", {
    props: [
        'values',
        'change',
        'id',
        'name',
    ],
    data: () => { return {}; },
    methods: {
        add: function() {
            this.values[this.id].push(newScopeGroup());
            this.change();
        },
        remove: function(i) {
            this.values[this.id].splice(i, 1);
            this.change();
        }
    },
    template: `
        <div>
            <div v-for="(i, idx) in values[id]" class="indent">
                <p>
                    <span style="font-weight: bold;"><span style="text-transform: capitalize;">{{name}}</span> #{{idx+1}}</span>
                    (<a href="#" v-on:click.prevent="remove(idx)">remove</a>)
                </p>
            <input-usages-scopes
                    :values="i"
                    :change="change" />
            </div>
            <p><a href="#" v-on:click.prevent="add()">add new {{name}} #{{values[id].length+1}}</a></p>
        </div>
    `
});

function newScopeGroup() {
    return {
        scopes: [],
        usages: [],
    };
}

function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function addNonEmptyField(d, k, v, mapper) {
    if (v === undefined || v === null) {
        return;
    }

    const type = typeof v;
    if (type == "string" && v.length == 0) {
        return;
    }

    if (mapper !== undefined) {
        v = mapper(v);
    }

    d[k] = v;
}

const vue = new Vue({
    el: "#vue",
    data: {
        client: {},
        contract: {
            accept_users_right_access_modify_transfer_delete: false,
            automated_decision: false,
            automated_surveillance: false,
            destination: [],
            evaluation_notation_rating_profiling: false,
            innovative_reasonable_expectations: false,
            mixing_reasonable_expectations: false,
            scopes: [],
            base: {
                contractual: newScopeGroup(),
                consent: [newScopeGroup()],
                legitimate: {
                    groups: [newScopeGroup()],
                },
            },
            subprocessors: [],
            transfer_outside_eea: false,
        },
        session: {
            consent: false,
            contractual: false,
            legitimate: false,
        },
        token: null,
        out: {},
    },
    methods: {
        change: function() {
            try {
                var secretSeed = sodium.from_base64(this.client.secret_seed_b64);
            } catch(e) {
                console.error(e);
                return;
            }

            const signSk = chain.signSeedKeypair(chain.seedOf(secretSeed, 32, "sign"));
            const boxSk = chain.boxSeedKeypair(chain.seedOf(secretSeed, 32, "box"));

            const secret = {
                seed: secretSeed,
                sign: signSk,
                box: boxSk,
            };

            const clientDecl = {
                type: 'alias.client.decl',
                crypto: {
                    sign: signSk.publicKey,
                    box: boxSk.publicKey,
                },
            };

            addNonEmptyField(clientDecl, "name", this.client.name);
            addNonEmptyField(clientDecl, "desc", this.client.desc);
            addNonEmptyField(clientDecl, "domain", this.client.domain);
            addNonEmptyField(clientDecl, "company", this.client.company);

            const clientDeclSigned = chain.sign(signSk, clientDecl);

            const base = {};

            if (this.session.contractual) {
                base.contractual = this.contract.base.contractual;
            }

            if (this.session.consent) {
                base.consent = this.contract.base.consent;
            }

            if (this.session.legitimate) {
                base.legitimate = this.contract.base.legitimate;
            }

            const contract = {
                type: 'alias.contract',
                legal: {},
                base: base,
                client: clientDeclSigned,
            };

            addNonEmptyField(contract.legal, "accept_users_right_access_modify_transfer_delete", this.contract.accept_users_right_access_modify_transfer_delete);
            addNonEmptyField(contract.legal, "automated_decision", this.contract.automated_decision);
            addNonEmptyField(contract.legal, "automated_surveillance", this.contract.automated_surveillance);
            addNonEmptyField(contract.legal, "destination", this.contract.destination);
            addNonEmptyField(contract.legal, "email_dpo", this.contract.email_dpo);
            addNonEmptyField(contract.legal, "evaluation_notation_rating_profiling", this.contract.evaluation_notation_rating_profiling);
            addNonEmptyField(contract.legal, "innovative_reasonable_expectations", this.contract.innovative_reasonable_expectations);
            addNonEmptyField(contract.legal, "mixing_reasonable_expectations", this.contract.mixing_reasonable_expectations);
            addNonEmptyField(contract.legal, "storage_duration", this.contract.storage_duration);
            addNonEmptyField(contract.legal, "subprocessors", this.contract.subprocessors);
            addNonEmptyField(contract.legal, "tos_url", this.contract.legal_tos_url);
            addNonEmptyField(contract.legal, "transfer_outside_eea", this.contract.transfer_outside_eea);
            addNonEmptyField(contract.legal, "usage", this.contract.legal_usage);

            this.out.client = clientDeclSigned;
            this.out.secret = secret;
            this.out.contract = contract;
            this.out.token = chain.toJSON(contract);
            this.$forceUpdate();
        },
        downloadSecret: function() {
            alert("WARNING! The content of this file contains your secret credentials. If you loose this file, you'll loose your identity in the network. If you leak this file, your identity will be stolen. Encrypt it and save it somewhere safe.");
            download("secret.json", chain.toToken(this.out.secret));
        },
        downloadClient: function() {
            download("client-" + chain.fold(this.out.client).base64() + ".json", chain.toToken(this.out.client));
        },
        downloadContract: function() {
            download("contract-" + chain.fold(this.out.contract).base64() + ".json", chain.toToken(this.out.contract));
        },
    },
});


chain.ready.then(() => {
    vue.client.secret_seed_b64 = sodium.to_base64(chain.seed());
    console.log(vue.client.secret_seed_b64);
    vue.change();
    vue.$forceUpdate();
});
