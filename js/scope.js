class Scope {
    constructor(provider, path, predicates, fields) {
        this.provider = provider;
        this.path = path;
        this.predicates = predicates;
        this.fields = fields;
    }

    getPredicate() {
        if (this.predicates == null) {
            return (i) => true;
        }

        throw "not implemented";
    }
}

module.exports.Scope = Scope;
