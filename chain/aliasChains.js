function assertHasFields(/*o, fieldA, [fieldB, [...]]*/) {
    const o = arguments[0];
    for (let i=1; i<arguments.length; ++i) {
        const name = arguments[i];
        if (!(name in o)) {
            throw `missing field: '${name}'`;
        }
    }
}

const validators = {
    // Binds the signer of this document to the authorization server defined in
    // this document.
    "alias.bindAuthz": (chain, o) => {
        assertHasFields(o, "origin");

        // XXX origin is an URL
    },

    // Document signed by a client describing its attributes
    "alias.client.decl": (chain, o) => {
        assertHasFields(o, "crypto", "name", "domain");
    },

    // Document representing a contract
    "alias.contract": (chain, o) => {
        assertHasFields(o, "client", "legal", "base");

        if (o.client.type != "anychain.signature") {
            throw "field 'client' is not a signature";
        }

        if (o.client.body.type != "alias.client.decl") {
            throw "field 'client' is not a signed client declaration";
        }
    },

    // Document representing a grant
    "alias.grant": (chain, o) => {
        assertHasFields(o, "contract", "revoked");

        if (o.contract.type != "alias.contract") {
            throw "field 'contract' is not an alias.contract";
        }

        if (o.revoked) {
            return;
        }

        assertHasFields(o, "base");

        if ('contractual' in o.contract.base) {
            assertHasFields(o.base, 'contractual');

            if (o.base.contractual != true) {
                throw "contractual part of the contract must be consented";
            }
        }


        if ('consent' in o.contract.base) {
            assertHasFields(o.base, 'consent');

            if (o.contract.base.consent.length != o.base.consent.length) {
                throw "bad length for consent consent";
            }

            for (const consent_idx in o.base.consent) {
                if (o.contract.base.consent[consent_idx].scopes.length !=
                    o.base.consent[consent_idx].length) {
                    throw "bad length for scopes of one consent consent";
                }
            }
        }

        if ('legitimate' in o.contract.base) {
            assertHasFields(o.base, 'legitimate');

            if (o.contract.base.legitimate.groups.length != o.base.legitimate.length) {
                throw "bad length for legitimate consent";
            }

            for (const legitimate_idx in o.base.legitimate.groups) {
                if (o.contract.base.legitimate.groups[legitimate_idx].scopes.length !=
                    o.base.legitimate[legitimate_idx].length) {
                    throw "bad length for scoeps of one legitimate consent";
                }
            }
        }
    },
};

// For a same contract, returns true if newGrant is newer than oldGrant.
// newGrant may be null.
function isGrantNewer(oldGrant, newGrant) {
    return oldGrant == null || (
        oldGrant.date < newGrant.date
    );
}

// Returns list of scopes consented by the user in one given grant.
function getGrantScopes(grant) {
    if (grant.body.revoked) {
        return [];
    }

    const contractBase = grant.body.contract.base;
    const grantBase = grant.body.base;
    const scopeById = {};

    function add(scope) {
        const scopeId = chain.fold(scope).base64();
        scopeById[scopeId] = scope;
    }

    // contractual base
    if (contractBase.contractual) {
        contractBase.contractual.scopes.forEach(add);
    }

    // consent
    if (contractBase.consent) {
        for (const groupIdx in contractBase.consent) {
            for (const scopeIdx in contractBase.consent[groupIdx].scopes) {
                if (grantBase.consent[groupIdx][scopeIdx]) {
                    add(contractBase.consent[groupIdx].scopes[scopeIdx]);
                }
            }
        }
    }


    // legitimate
    if (contractBase.legitimate) {
        for (const groupIdx in contractBase.legitimate.groups) {
            for (const scopeIdx in contractBase.legitimate.groups[groupIdx].scopes) {
                if (grantBase.legitimate[groupIdx][scopeIdx]) {
                    add(contractBase.legitimate.groups[groupIdx].scopes[scopeIdx]);
                }
            }
        }
    }

    return Object.values(scopeById);
}

// Returns list of scopes mentionned in a contract
function getContractScopes(contract) {
    const scopeById = {};

    function add(scope) {
        const scopeId = chain.fold(scope).base64();
        scopeById[scopeId] = scope;
    }

    // contractual base
    if (contract.base.contractual) {
        contract.base.contractual.scopes.forEach(add);
    }

    // consent
    if (contract.base.consent) {
        for (const groupIdx in contract.base.consent) {
            for (const scopeIdx in contract.base.consent[groupIdx].scopes) {
                add(contract.base.consent[groupIdx].scopes[scopeIdx]);
            }
        }
    }


    // legitimate
    if (contract.base.legitimate) {
        for (const groupIdx in contract.base.legitimate.groups) {
            for (const scopeIdx in contract.base.legitimate.groups[groupIdx].scopes) {
                add(contract.base.legitimate.groups[groupIdx].scopes[scopeIdx]);
            }
        }
    }

    return Object.values(scopeById);
}

const describers = {
    "alias.bindAuthz": (chain, o) => {
        return `user is bound to authorization server ${o.origin}`;
    },
    "alias.grant": (chain, o) => {
        if (o.revoked) {
            return `contract revocation`;
        } else {
            return `contract signature`;
        }
    },
};

// Returns a description of what an order is about
function describeOrder(chain, order) {
    const describer = describers[order.type];
    return describer === undefined ? null : describer(chain, order);
}

const AliasChains = {
    describeOrder: describeOrder,
    getContractScopes: getContractScopes,
    getGrantScopes: getGrantScopes,
    isGrantNewer: isGrantNewer,
    validators: validators,
};

(function() {
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = AliasChains;
    }
    else {
        window.AliasChains = AliasChains;
    }
})();
