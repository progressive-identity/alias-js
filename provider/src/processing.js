const WebSocket = require('ws');

function process(o) {
    return new Promise((resolve, reject) => {
        const resp = {};
        const ws = new WebSocket(config.processor[0].ws_url);

        ws.on('open', () => {
            ws.send(JSON.stringify(o));
        });

        ws.on('message', (m) => {
            m = JSON.parse(m);
            //console.log("from ws: ", m);

            if (m.outs) {
                resp.outs = m.outs;
            }

            if (m.error) {
                resp.error = m.error;
            }
        });

        ws.on('close', (m) => {
            if (resp.error) {
                return reject(resp.error);
            }

            return resolve(resp.outs);
        });
    });
}

module.exports.process = process;
