const alias = require("./alias.js");
const {google} = require('googleapis');
const gdrive = require('./gdrive.js');

function process(in_fh) {
    //let in_fh = new alias.file.UrlReaderSync(path);
    let in_archive = new alias.rs.TarGzArchiveReader(in_fh);

    let out_fh = new alias.file.UrlWriterSync("http://localhost:8081/files/pouet/dump1.tgz");
    let out_archive = new alias.rs.TarGzArchiveWriter(out_fh);

    // declare first watchers
    let w = new alias.Watchers();
    w.open("Takeout/My Activity/Assistant/MyActivity.json", function(path, reader) {
        if (!reader) {
            console.error("myactivity.json not found");
            return;
        }

        let content = reader.json();

        let w = new alias.Watchers();
        content.filter(i => "audioFiles" in i).forEach(function(i) {
            i.audioFiles.forEach(function(af) {
                let path = "Takeout/My Activity/Assistant/" + af;
                w.open(path, function(path, reader) {
                    console.log(path);
                    if (reader) {
                        out_archive.add_entry_with_reader(path, reader);
                    }
                });
            });
        });

        return new Alias.WatchersWrapper(w);
    });
    in_archive.watch(w);

    // process
    for (;;) {
        let r = in_archive.step();
        if (!r) {
            break;
        }
    }

    return out_archive.finish();
}


async function explore_gdrive() {
    const auth = await gdrive.getHandler();
    const access_token = auth.credentials.access_token;

    const drive = google.drive({version: 'v3', auth});

    console.log("listing...");
    const files = await list(drive, {pageSize: 1});
    const file = files[0]


    let url = "https://www.googleapis.com/drive/v3/files/" + file.id;

    url = url + "?alt=media"

    const syncRequest = require('sync-request');
    const res = syncRequest('GET', url, {
        headers: {
            'Authorization': 'Bearer ' + access_token,
            'Range': 'bytes=0-16',
        }
    });

    let body = new Uint8Array(res.body);
    //let str = alias.rs.from_utf8(body);
    //console.log(str);

    return body;

    //console.log("downloading...");
    //const data = await download(drive, file.id);
    //console.log("downloaded");
    //return data;
}

async function main() {
    let in_fh = null;
    if (false) {
        const auth = await require('./gdrive.js').getHandler()
        const drive = google.drive({version: 'v3', auth});

        const files = await gdrive.list(drive, {pageSize: 1});
        const fileId = files[0].id

        in_fh = gdrive.newSyncReader(auth, fileId);
    } else {
        in_fh = new alias.file.UrlReaderSync('http://localhost:8080/dump-my_activity.tgz');
    }

    const res = process(in_fh);

    console.log("file uploaded Blake2b: ", res.to_hex());

    return null;
}

main().then((v) => {
    console.log("exit: ", v);
}).catch(console.error);

/*
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Drive API.
  authorize(JSON.parse(content), listFiles);
});
*/

//let h = process('http://localhost:8080/dump-my_activity.tgz');

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

