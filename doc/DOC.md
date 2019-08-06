# Alias v1.1 - PoC

This repository contains WIP of a v1.1 proposal of the Alias protocol and
framework. It is intended to demo the UX/UI of this new flow, while implementing
the final building blocks of a reference design implementation.

## Summary

Alias is a protocol and a framework to let end-users share their personal data
with third-parties in a safe and decentralized manner. It is similar to the
OAuth 2.0 flow, where a requesting party (Client) requests access to data (under
certain Scopes) to the user's "data bank" (Authorization server). If the user is
willing to grant access, a token is generated and given to the Client, able to
access the data with it.

In the case of Alias, the user agreement is represented by a digitally signed
document describing the grant, and encoded as a token. It is similar to JWT, but
as explained bellow, these documents are encoded as merkle tree and can
reference other signed documents.

The token is a value which is secure if leaked, as accessing data requires the
client to use a client-side TLS certificate referenced in the token, or a
symmetric key to decrypt the data only the client can get. Each party is
identified by their public keys. For users, authentication devices may be used
to store user's secret.

A user is able to change their Authorization server, by signing a special token
encoding their new Authorization server, and which makes previously generated
tokens still valid.

Alias defines a Scope as a provider (the data source, e.g. Google), a path to
the resource (e.g. only the Google Search history), a set of predicates to
filter wanted data (e.g. only searches done the last year) and a set fields to
map a filtered object to only its wanted fields (e.g. only the date of the
search, not the search itself).

The protocol Alias stays agnostic of the served data model by defining Data
processors, software modules responsible to parse the original data model from
the data provider and maps it to its corresponding scope. There are instantiated
when an Authorization server is serving data to a Client. They must be compiled
into WebAssembly or Javascript (as data processing can happen at the browser
side) and respect a certain interface.

Users are identified by aliases, which have the same nomencalture than email
address, e.g.  john.doe@authz-alias.com. The domain (e.g. 'authz-alias.com') is
the Authorization server's. An alias is enough information for a client to
redirect the user to its authorization server.

## Tokens

In Alias, Tokens are the URL-safe non padded base64 form of a JSON object. These
JSON objects may serialize byte arrays (in Javascript, Uint8Array), digest value
(Blake2b's, SHA3's), digital signatures.

The hash of such JSON object is calculated as the root hash of the JSON object
casted as a merkle tree. It is therefore possible to make a certain branch of
the object opaque by only referencing its Merkle tree's root hash. Its digital
signature is therefore still verifiable even if not all data is stored in the
token. This makes token be able to securely reference to large amount of data,
like user's data files or legal documentation the user digitally signed.

Tokens are cryptographic chains (similar to the ones in Blockchains), and may
reference to other part of the chain without storing it.

Each party is incintived to store and serve all chains legally asserting a bind
with another party in its interest (e.g. a client will keep the token giving it
access to an user's data, an user will keep the token defining the migration
from one authorization server to another, ...).

### Signatures & revocations

A digital signature of a JSON object is also encoded as a JSON object. One
digital signature may reference other digital signatures.

For example, a grant token encodes a digital signature by the user to a JSON
object setting the authorized scopes, the read legal documents and the clients
declaration token, itself signed by the client.

A signature is revocable by signing a revocation JSON object referencing the
revoked signature. Revoking a grant token will remove the client access to its
user's data.

### Model

A byte array is encoded in its URL-safe non padded Base64 form:

```json
{
    "some_bytes": {
        "__bytes": "Qp3te6cg_gNzzmqJPbNFBLbW_FP0yWTWxLdig_OG-lAsWS3J1YWNK0q6-yYkU6BRYsk_h6uGL8yCfUFbpRTqDQ"
    }
}
```

The fold reference of a JSON object is encoded as such:

```json
{
    "fold": {
        "__hash": "t0KTaHe0tmL9NQTEYCEJKGfNHiQ5Vkb3w8CJV3QQg08SqD9lU5z_UpxPXk2VgvOjbLK-br8LtphHUfb9NLEmTg",
    },
}
```
A signature JSON object is encoded as such:

```json
{
    "type": "anychain.signature",
    "date": "Wed, 17 Jul 2019 10:21:05 GMT",
    "signer": {
        "__bytes": "cxAB1XqKCLKjxtKi2TPa98Z_ttT-gNEN6BZRCz9f8RI"
    },
    "body": <signed JSON object>,
    "signature": {
        "__bytes": "Qp3te6cg_gNzzmqJPbNFBLbW_FP0yWTWxLdig_OG-lAsWS3J1YWNK0q6-yYkU6BRYsk_h6uGL8yCfUFbpRTqDQ"
    }
}
```

## Flow

When a client wants to request specific data from a user, it first asks the
user's alias.

    Alias: john.doe@authz.alias

The client first checks the domain is an Alias authorization server. It performs
a GET request on the path `/alias/`:

```
$ curl https://authz.alias/alias/
{
    "what": "alias authz server",
    "reqPath": "/alias/request/",
}
```

The field `reqPath` contains the path to which the user should be redirected.
The following GET parameters are set :

- `client_id`: the client declaration token (see below), or an URL which serves
  it;
- `scopes`: a list of scopes separated by a space;
- `username`: the user's username in its alias. optional;
- `state`: any value from the client which will be given back when the client
  will be called back;

The client declaration token is a document setting all metadata about the
client, and signed by the client's key. Its body contains:

1. the name, description about the client;
2. legal information about how and by whom the data will be processed;
3. a callback URL, on which the user will be redirected when the grant is agreed
   or not;
4. a location where the user's data should be uploaded;

```json
{
    "type": "anychain.signature",
    "date": "Wed, 17 Jul 2019 10:14:27 GMT",
    "signer": {
        "__bytes": "fcuEV6SlCzSknWPHbPFr_Zpdrwu4tub-ffTYTdICd14"
    },
    "body": {
        "type": "alias.client.decl",
        "desc": "Teach machines how real people speak.",
        "name": "Common Voice",
        "legal": {
            "usage": "Data will be imported in the public-domain Common Voice database in order to be used as a machine learning dataset to improve public research on Voice Recognition and AI.",
            "third": [
                "Mozilla.org, and partners involved in the Common Voice project"
            ]
        },
        "domain": "client.alias",
        "redirect_url": "https://client.alias/alias/cb/",
        "chain_url": "http://client.alias/alias/chain/",
        "crypto": {
            "sign": {
                "__bytes": "fcuEV6SlCzSknWPHbPFr_Zpdrwu4tub-ffTYTdICd14"
            },
            "box": {
                "__bytes": "kdMYOJoHSERLLFok0iPbPhA4DNl59I7RXoD3vGh4SUU"
            }
        }
    },
    "signature": {
        "__bytes": "SJ_7LegoxvvUDjgKUf4snIq-oAbWsSP3ZsZqZV1nSqR-RYACBXLLR05S_609kJGpn5sqwtkwXdB5RdE23Qr2CQ"
    }
}
```

For example, for a scope `foo.bar.*`, the URL redirection might be:

    https://authz.alias/alias/request/?
        client_id=https://client.alias/alias/&
        scopes=foo.bar.*&
        username=john.doe

When on the authorization server, it verifies and validates the client
declaration token and displays information about the client, legal info and
requested scopes.

If the user denies access, they will be redirected to the client's redirect
callback with a GET parameter `error` set to `access_denied`.

If the user agrees, it signs a grant token and is redirected to the client's
redirect callback with a GET parameter `code` set to the token.

    https://client.alias/alias/cb/?
        code=cxAB1XqKCLK...

The JSON form of the token looks like this:

```json
{
    "type": "anychain.signature",
    "date": "Wed, 17 Jul 2019 10:21:05 GMT",
    "signer": {
        "__bytes": "cxAB1XqKCLKjxtKi2TPa98Z_ttT-gNEN6BZRCz9f8RI"
    },
    "body": {
        "type": "grant",
        "scopes": [
            "foo.bar.*"
        ],
        "client": <the previous client declaration token>,
        "fetch": {
            "frontURL": "http://authz.alias/alias/process/"
            "backURL": "http://authz.alias/alias/process/"
        }
    },
    "signature": {
        "__bytes": "Qp3te6cg_gNzzmqJPbNFBLbW_FP0yWTWxLdig_OG-lAsWS3J1YWNK0q6-yYkU6BRYsk_h6uGL8yCfUFbpRTqDQ"
    }
}
```

Authorized scopes are set as an array in the field `scopes`.

`fetch.frontURL` is the URL on which the user should be redirected to extract
the requested data and sends them to the client. `fetch.backURL` is the URL the
client can request a POST on to extract the requested data and sends them to the
client. The difference between both is processing happens on the browser-side
for the first, on the server-side for the second. The second makes processing
happen in the background, but is less secure as the server is able to decrypt
the data which might leak. At least one of these two URLs must be set.

### Data processing

With a valid grant token, a client is able to request the authorization server
to serve the data scoped by the token.

To do so, authorization servers invokes the data processors associated to the
scopes' providers, and run them to filters the resources accessible by the
client and upload them. They fetch data from an URL, e.g. an Google Drive URL to a tarball
storing data to be processed. They uploads a new tarball to the client's server
to be processed.

If the authorization server makes processing happen at the browser-side, a
processing window will happen after grant was given and before redirecting back
to the client.

## Future

- Encryption of dumps
- Better scope serialization?

