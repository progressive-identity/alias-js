class Scope {
    constructor(provider, path, predicates, fields) {
        this.provider = provider;
        this.path = path;
        this.predicates = predicates;
        this.fields = fields;
    }

    match(e) {
        if (this.predicates == null) {
            return true;
        }

        throw "not implemented";
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
