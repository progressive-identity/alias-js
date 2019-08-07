let predicateByOps = {
    "=":   function(e, field, val) { return e[field] === val; },
    "!=":  function(e, field, val) { return e[field] !== val; },
    ">":   function(e, field, val) { return e[field] > val; },
    ">=":  function(e, field, val) { return e[field] >= val; },
    "<":   function(e, field, val) { return e[field] < val; },
    "<=":  function(e, field, val) { return e[field] <= val; },
};

class Scope {
    constructor(provider, path, predicates, fields) {
        this.provider = provider;
        this.path = path;
        this.predicates = predicates || [];
        this.fields = fields;
    }

    match(e) {
        for (const pred in this.predicates) {
            const op = pred[0];
            const predFunc = predicateByOps[op];
            if (pred === undefined) {
                throw "unknown predicate operator: " + op;
            }

            if (!predFunc(e, ...pred.slice(1))) {
                return false;
            }
        }

        return true;
    }

    filterFields(e) {
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
}

module.exports.Scope = Scope;
