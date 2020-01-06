const redis = require('./redis.js')

async function getHistoryRange(publicKey, start, end) {
    const grantTokens = await redis.db.lrange(redis.key("user", publicKey, "history"), start, end);
    const grants = grantTokens.map((tok) => chain.fromSafeToken(tok));
    return grants;
}

module.exports.getHistoryRange = getHistoryRange;

