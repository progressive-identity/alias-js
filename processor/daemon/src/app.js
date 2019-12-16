global.config = require('./config.js');
const alias = require("@alias/processor-base");
const anychain = alias.anychain;
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();

app.use(require('morgan')('tiny'));
app.use(require('body-parser')());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

async function handle_process(ws, d) {
    try {
        d = JSON.parse(d);
    } catch(e) {
        console.error("incorrect format");
        ws.close();
        return;
    }

    try {
        let scopes = d.scopes.map((s) => new alias.Scope(s));

        var args = {
            pushURL: d.pushURL,
            inp: d.inp,
            scopes: scopes,
        };

    } catch(e) {
        console.log("bad payload");
        ws.close();
        return;
    }

    console.log("Start processing");

    let r = [];
    r.push("... " + args.inp.length + " input(s):\n");
    args.inp.forEach((inp) => r.push("... - " + inp.url + "\n"));
    r.push("... with scopes:\n");
    args.scopes.forEach((scope) => r.push("... - " + scope.provider + "." + scope.path + "\n"));
    r.push("... to " + args.pushURL + "\n");
    console.log(r.join(""));

    ws.startDate = new Date();
    ws.sendJson({"init": true});
    const cb = ws.sendJson;
    ws.processor = new alias.Processor(cb);
    const res = await ws.processor.process_and_exit(args);

    ws.processor.terminate();
    delete ws.processor;

    const endDate = new Date();
    const duration = (endDate - ws.startDate) / 1000.0;
    console.log("Processing finished in " + duration + "s!");

    if (res) {
        ws.sendJson(res);
    }
}

wss.on('connection', (ws) => {
    ws.sendJson = (x) => ws.send(JSON.stringify(x));

    ws.on('message', (d) => {
        handle_process(ws, d).then(() => {
            console.log("exit");
            ws.close(1000);
        }).catch((err) => {
            console.error("error", err);
            ws.sendJson({error: err});
            console.log("failure exit");
            ws.close(1011);
        });
    });

    ws.on('close', () => {
        if (ws.processor) {
            console.debug("processing cancelled");
            ws.processor.terminate();
            delete ws.processor;
        }
    });
});

app.get('/alias/', (req, res) => {
    res.send({
        what: "alias processor server",
    });
});

app.get('/alias/scope/', (req, res) => {
    if (!req.query.scopes) {
        return res
            .status(400)
            .send({status: 'error', reason: `missing 'scopes' argument`});
    }

    const scopes = JSON.parse(req.query.scopes);
    res.json(scopes.map(s => (new alias.Scope(s)).describe()));
});

(async() => {
    await alias.init();
    await server.listen(config.http.listenPort);
    console.log(`listening on port ${server.address().port}`);
})();

