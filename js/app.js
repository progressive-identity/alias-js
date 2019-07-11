const alias = require("./alias.js");
const {google} = require('googleapis');
const gdrive = require('./gdrive.js');

async function main() {
    let inp = null;
    if (true) {
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

