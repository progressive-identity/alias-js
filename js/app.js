let alias = require("./alias.js");

function process(path) {
    let in_fh = new alias.file.UrlReaderSync(path);
    let in_archive = new alias.rs.TarGzArchiveReader(in_fh);

    let out_fh = new alias.file.UrlWriterSync("http://localhost:8081/files/foo.tar.gz");
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
                    //console.log(path);
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

let h = process('http://localhost:8080/dump-my_activity.tgz');

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

let files = [h];
let token = generate_token(true, files);
token['_hash'] = alias.rs.hash(generate_token(false, files)).to_hex();

//process('http://localhost:8080/dump-10G-photos.tgz');

let fh = new alias.file.UrlWriterSync("http://localhost:8081/files/bar");
fh.write_string(JSON.stringify(token));
fh.finish();
