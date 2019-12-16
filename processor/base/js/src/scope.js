const processorRouter = require('../../../providers/all.js');

let predicateByOps = {
    "=":   function(e, field, val) { return e[field] === val; },
    "!=":  function(e, field, val) { return e[field] !== val; },
    ">":   function(e, field, val) { return e[field] > val; },
    ">=":  function(e, field, val) { return e[field] >= val; },
    "<":   function(e, field, val) { return e[field] < val; },
    "<=":  function(e, field, val) { return e[field] <= val; },
    "has": function(e, field) { return field in e },
};

class Scope {
    constructor(scope) {
        this.provider = scope.provider;
        this.path = scope.path;
        this.predicates = scope.predicates || [];
        this.fields = scope.fields || null;
    }

    filter(col) {
        return col.filter(this.match.bind(this)).map(this.mapFields.bind(this));
    }


    match(e) {
        for (const pred of this.predicates) {
            const op = pred[0];
            const predFunc = predicateByOps[op];
            if (!predFunc) {
                throw "unknown predicate operator: " + op;
            }

            if (!predFunc(e, ...pred.slice(1))) {
                return false;
            }
        }

        return true;
    }

    mapFields(e) {
        if (this.fields == null) {
            return e;
        }

        let o = {};
        for (const i in this.fields) {
            const field = this.fields[i];
            o[field] = e[field];
        }

        return o;
    }

    hasField(field) {
        if (this.fields == null) {
            return true;
        }

        return this.fields.indexOf(field) != -1;
    }

    describe() {
        const r = {
            provider: this.provider,
            path: this.path,
            predicates: this.predicates,
            fields: this.fields,
        };

        const proc = processorRouter.get(this.provider);
        if (proc == null) {
            return r;
        }

        r.providerDesc = proc.name;

        const pathDesc = proc.descByPath[this.path];
        if (pathDesc) {
            r.pathDesc = pathDesc;
        }

        // XXX add predicates
        // XXX add fields

        return r;
    }
}

module.exports.Scope = Scope;
