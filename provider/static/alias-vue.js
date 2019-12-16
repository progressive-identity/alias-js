function describeScopeEnglish(scope) {
    if (!('providerDesc' in scope && 'pathDesc' in scope)) {
        return null;
    }

    const r = [];
    const hasProvider = scope.pathDesc.toLowerCase().includes(scope.providerDesc.toLowerCase())

    if (hasProvider) {
        r.push(scope.pathDesc);
    } else {
        r.push(`${scope.providerDesc}'s ${scope.pathDesc}`);
    }

    r.push(" data");

    return r.join("");
}

Vue.component('alias-scope', {
    props: ['value', 'descmap'],
    data: function() {
        const r = {
            desc: null,
        };

        if (!this.descmap) {
            return r;
        }

        var scopeList = [
            ['provider', this.value.provider],
            ['path', this.value.path],
            ['predicates', this.value.predicates],
            ['fields', this.value.fields],
        ];
        const scope = {};
        for (const [k, v] of scopeList) {
            if (v !== undefined) {
                scope[k] = v;
            }
        }

        const k = chain.fold(scope).base64();
        const desc = this.descmap[k];
        r.desc = desc ? describeScopeEnglish(desc) : null;

        return r;
    },
    methods: {
        formatScope: formatScope,
    },
    template: `
        <span v-if="desc" :title="formatScope(value)" class="titled">
        {{ desc }}
        </span>
        <span v-else>
        data scoped <code>{{ formatScope(value) }}</code>
        </span>
    `
});

