let alias = require("./alias.js");

let myDump = new alias.file.SynchronousURLFile('http://localhost:8080/dump-my_activity.tgz');
//let myDump = new alias.file.SynchronousURLFile('http://localhost:8080/dump-10G-photos.tgz');

let archive = new alias.rs.TarGzArchive(myDump);

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
            });
        });
    });

    return new Alias.WatchersWrapper(w);
});

archive.watch(w);

for (;;) {
    let r = archive.step();
    if (!r) {
        break;
    }
}

