function assertHasFields(/*o, fieldA, [fieldB, [...]]*/) {
    const o = arguments[0];
    for (let i=1; i<arguments.length; ++i) {
        const name = arguments[i];
        if (!(name in o)) {
            throw `missing field: '${name}'`;
        }
    }
}

/*function getGrantSignatures(o) {
    if (o.type != "alias.multigrant") {
        throw "not an 'alias.multigrant'";
    }

    let r = [];

    const contractFold = chain.fold(o.contract);
    if ('consent' in o.contract.base) {
        assertHasFields(o.signatures, "consent");

        for (const idx in o.contract.base.consent) {
            const signature = o.signatures.consent[idx];

            if (signature === undefined) {
                throw "signature for consent undefined";
            }

            if (signature === null) {
                continue;
            }

            r.push({
                base: o.contract.base.consent[idx],
                signature: {
                    type: 'alias.signature',
                    signer: o.signer,
                    date: o.date,
                    body: {
                        contract: contractFold,
                        base: 'consent',
                        idx: idx,
                    },
                    signature: signature,
                },
            });
        }
    }

    if ('contractual' in o.contract.base) {
        assertHasFields(o.signatures, "contractual");

        const signature = o.signatures.contractual;
        if (signature === undefined) {
            throw "signature for contractual undefined";
        }

        if (signature === null) {
            continue;
        }

        r.push({
            base: o.contract.base.contractual,
            signature: {
                type: 'alias.signature',
                signer: o.signer,
                date: o.date,
                body: {
                    contract: contractFold,
                    base: 'contractual',
                },
                signature: signature,
            },
        });
    }

    if ('legitimate' in o.contract.base) {
        assertHasFields(o.signatures, "legitimate");
        for (const idx in o.contract.base.legitimate.groups) {
            const signature = o.signatures.legitimate[idx];
            if (signature === undefined) {
                throw "signature for legitimate undefined";
            }

            if (signature === null) {
                continue;
            }

            r.push({
                base: o.contract.base.legitimate.groups[idx],
                signature: {
                    type: 'alias.signature',
                    signer: o.signer,
                    date: o.date,
                    body: {
                        contract: contractFold,
                        base: 'legitimate',
                        idx: idx,
                    },
                    signature: signature,
                },
            });
        }
    }

    return r;
}

function signGrant(chain, sk, contract, consentBools) {
    const date = new Date();

    const grant = {
        type: 'alias.multigrant',
        signatures: {},
        signer: sk.publicKey,
        date: date,
    };

    const contractFold = chain.fold(contract);
    if ('consent' in contract.base) {
        grant.signatures.consent = [];
        for (const idx in contract.base.consent) {
            let signature = null;

            if (consentBools[idx]) {
                const body = {
                    contract: contractFold,
                    base: 'consent',
                    idx: idx,
                };

                {signature} = chain.sign(sk, body, date);
            }

            grant.signatures.consent.push(signature);
        }
    }

    if ('contractual' in contract.base) {
        const body = {
            contract: contractFold,
            base: 'contractual',
        };

        const {signature} = chain.sign(sk, body, date);

        grant.signatures.contractual = signature;
    }

    if ('legitimate' in contract.base) {
        grant.signatures.legitimate = [];
        for (const idx in contract.base.legitimate.groups) {
            const body = {
                contract: contractFold,
                base: 'legitimate',
                idx: idx,
            };

            const {signature} = chain.sign(sk, body, date);

            grant.signatures.legitimate.push(signature);
        }
    }

    // XXX for debug
    chain.verify(grant);

    return grant;
}*/

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
/*
    "alias.multigrant": (chain, o) => {
        assertHasFields(o, "contract", "signatures", "signer", "date");

        if (o.contract.type != "alias.contract") {
            throw "field 'contract' is not an alias.contract";
        }

        // Verify all signatures included in the grant
        for (const {signature} of getGrantSignatures(o)) {
            if (signature.type != "anychain.signature") {
                throw "assertion error: signatures from the grant are not anychain signatures";
            }

            chain.verify(signature);
        }
    },*/
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

const AliasChains = {
//    getGrantSignatures: getGrantSignatures,
//    signGrant: signGrant,
    validators: validators,
    isGrantNewer: isGrantNewer,
    getGrantScopes: getGrantScopes,
};

(function() {
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = AliasChains;
    }
    else {
        window.AliasChains = AliasChains;
    }
})();
