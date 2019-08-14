const Redis = require('ioredis');

module.exports.key = function() {
    let r = [];
    for (let o of arguments) {
        if (o && typeof(o) == "object" && o.constructor == Uint8Array) {
            o = sodium.to_base64(o);
        }
        r.push(o);
    }

    return r.join(":");
}

module.exports.db = new Redis(config.redis);
