const alias = require("@alias/processor-base");
const ws = require('nodejs-websocket');

const listenPort = parseInt(process.env.ALIAS_PROCESSOR_DAEMON_PORT) || 8080;

class Server {
    constructor() {
        this.server = ws.createServer(this._onconnect.bind(this));
    }

    listen(port) {
        return this.server.listen(port);
    }

    _onconnect(conn) {
        var self = this;
        conn.on("text", function(d) { self._ontext(conn, d); });
        conn.on("close", function() { self._onclose(conn); });
    }

    _onclose(conn) {
        if (conn.processor) {
            console.debug("processing cancelled");
            conn.processor.terminate();
            delete conn.processor;
        }
    }

    _ontext(conn, d) {
        conn.sendJson = function(obj) { conn.sendText(JSON.stringify(obj)); };

        this._handle(conn, d)
            .catch((er) => {
                console.error("error", er);
                conn.sendJson({error: er});
                console.log("failure exit");
                conn.close(1011);
            })
            .then(() => {
                console.log("exit");
                conn.close(1000);
            })
        ;
    }

    async _handle(conn, d) {
        try {
            var d = JSON.parse(d);
        } catch(e) {
            console.error("incorrect format");
            conn.close();
            return;
        }

        try {
            let scopes = d.scopes.map((s) => new alias.Scope(s[0], s[1], s[2], s[3]));

            var args = {
                client_url: d.client_url,
                inp: d.inp,
                scopes: scopes,
            };

        } catch(e) {
            console.log("bad payload");
            conn.close();
            return;
        }

        console.log("Start processing");
        console.log(this._describe(args));

        conn.startDate = new Date();
        conn.sendJson({"init": true});
        const cb = conn.sendJson;
        conn.processor = new alias.Processor(cb);
        const res = await conn.processor.process_and_exit(args);

        conn.processor.terminate();
        delete conn.processor;

        const endDate = new Date();
        const duration = (endDate - conn.startDate) / 1000.0;
        console.log("Processing finished in " + duration + "s!");

        if (res) {
            conn.sendJson(res);
        }
    }

    _describe(args) {
        let r = [];

        r.push("... " + args.inp.length + " input(s):\n");
        args.inp.forEach((inp) => r.push("... - " + inp.url + "\n"));
        r.push("... with scopes:\n");
        args.scopes.forEach((scope) => r.push("... - " + scope.provider + "." + scope.path + "\n"));
        r.push("... to " + args.client_url + "\n");

        return r.join("");
    }
}

const anychain = alias.anychain;

(async() => {
    await alias.init();

    (new Server()).listen(listenPort);
    console.log("listening on " + listenPort);
})();

