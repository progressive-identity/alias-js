Vue.component('verb', {
    props: ['value'],
    data: () => { return {}; },
    template: `
<span v-if="value"><b style="text-transform: uppercase;"><slot></slot></b></span><span v-else-if="!value"><slot></slot> <b>NOT</b></span>
`,
});

const vue = new Vue({
    el: "#vue",
    data: {
        id: null,
        o: null,
    },
    methods: {
        toJSON: (o) => chain.toJSON(o),
        formatScope: formatScope,
        orderID: (o) => chain.fold(o).base64(),
        toBase64: (v) => sodium.to_base64(v),
    },
});

function run() {
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

    vue.o = o;
    vue.id = chain.fold(o).base64();
};

