const redis = require('./redis.js')

async function getHistoryRange(publicKey, start, end) {
    const orderTokens = await redis.db.lrange(redis.key("user", publicKey, "history"), start, end);
    const orders = orderTokens.map((tok) => chain.fromSafeToken(tok));
    return orders;
}

module.exports.getHistoryRange = getHistoryRange;

