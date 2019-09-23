Vue.component('alias-scope', {
    props: ['value'],
    data: () => { return {}; },
    methods: {
        formatScope: formatScope,
    },
    template: `
        <span v-if="value.desc">
        {{ value.desc }} (<code>{{ formatScope(value) }}</code>)
        </span>
        <span v-else>
        <code>{{ formatScope(value) }}</code>
        </span>
    `
});

