let alias = require("./alias.js");

function process(path) {
    let fh = new alias.file.UrlReaderSync(path);
    let archive = new alias.rs.TarGzArchive(fh);

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
                    console.log(path, reader);
                    if (reader) reader.drop();
                });
            });
        });

        return new Alias.WatchersWrapper(w);
    });
    archive.watch(w);

    // process
    for (;;) {
        let r = archive.step();
        if (!r) {
            break;
        }
    }
}

//process('http://localhost:8080/dump-my_activity.tgz');
//process('http://localhost:8080/dump-10G-photos.tgz');

let fh = new alias.file.UrlWriterSync("http://localhost:8081/files/foo");
alias.rs.debug(fh);
