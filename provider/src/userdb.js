const level = require('level');
const sodium = require('libsodium-wrappers');

const dbPath = process.env.ALIAS_AUTHZ_USERDB_PATH || "userdb";
const db = level(dbPath, {
    keyEncoding: 'utf-8',
    valueEncoding: 'json',
});


function get(username, pwd) {
    const k = username;

    return db.get(k)
        .then((v) => {
            // XXX constant-time equality?
            if (v.pwd !== pwd) {
                return Promise.reject("bad password");
            }

            return v.box;
        })
        .catch((e) => {
            if (e.notFound) {
                return null;
            }
            return Promise.reject(e);
        })
    ;
}

function put(username, pwd, box) {
    return get(username, pwd).then((_) => {
        const k = username;
        const v = {
            pwd: pwd,
            box: box,
        };

        return db.put(k, v);
    });
}

function del(username, pwd) {
    return get(username, pwd).then((v) => {
        if (v == null) {
            return false;
        }

        const k = username;
        return db.del(k).then(() => true);
    });
}

module.exports.get = get;
module.exports.put = put;
module.exports.del = del;
