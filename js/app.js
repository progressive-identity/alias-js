const alias = require("./alias.js");
const {google} = require('googleapis');
const gdrive = require('./gdrive.js');

const ws = require('nodejs-websocket');

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
        this._handle(conn, d)
            .catch(() => console.error())
            .finally(() => {
                console.log("exit");
                conn.close();
            })
        ;
    }

    async _handle(conn, d) {
        let send = function(obj) {
            conn.sendText(JSON.stringify(obj));
        };

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
                onprogress: send,
            };

        } catch(e) {
            console.log("bad payload");
            conn.close();
            return;
        }

        console.log("Start processing");
        console.log(this._describe(args));

        conn.processor = new alias.Processor(args);
        conn.startDate = new Date();
        send({"init": true});
        await conn.processor.init()
        const res = await conn.processor.run();

        conn.processor.terminate();
        delete conn.processor;

        const endDate = new Date();
        const duration = (endDate - conn.startDate) / 1000.0;
        console.log("Processing finished in " + duration + "s!");

        send(res);
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

(new Server()).listen(8000);

/*
async function main() {
    let inp = null;
    if (false) {
        const auth = await require('./gdrive.js').getHandler()
        const drive = google.drive({version: 'v3', auth});

        const files = await gdrive.list(drive, {pageSize: 1});
        const file = files[0];

        inp = gdrive.getDownloadRequest(auth, file.id, file.size);
    } else {
        inp = {url: 'http://localhost:8080/dump-my_activity.tgz'};
    }

    const scopes = [
        new alias.Scope("google", "myactivity.assistant", null, ["audioFiles", "time", "title"]),
        new alias.Scope("google", "myactivity.search", null, null),
    ];

    const proc = new alias.Processor({
        client_url: "http://localhost:8081/files/debug",
        inp: [inp],
        scopes: scopes,
        onprogress: console.log,
    });

    await proc.init();
    const res = await proc.run();
    proc.terminate();

    return res;
}

main().then((v) => {
    console.log("exit: ", v);
}).catch(console.error);

function generate_token(to_json, files) {
    if (to_json) {
        files = files.map((h) => h.to_hex());
    } else {
        files = files.map((h) => new alias.HashWrapper(h));
    }
    return {
        "type": "grant",
        "client": "pouet",
        "scopes": [
            "google.photos.*",
            "google.foo.*",
        ],
        "files": files,
    };
}

/*let files = [h];
let token = generate_token(true, files);
token['_hash'] = alias.rs.hash(generate_token(false, files)).to_hex();

//process('http://localhost:8080/dump-10G-photos.tgz');

let fh = new alias.file.UrlWriterSync("http://localhost:8081/files/bar");
fh.write_string(JSON.stringify(token));
fh.finish();
*/

