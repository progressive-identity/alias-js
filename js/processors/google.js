let path = {}

path["myactivity.assistant"] = function(scope) {
    return function(w, p) {
        const archive_path = "google_myactivity_assistant";

        const on_audio_files = function(path, reader) {
            //console.log(path);
            if (reader) {
                p.out_archive("google_myactivity_assistant").add_entry_with_reader(path, reader);
            }
        };

        const on_index = function(path, reader) {
            if (!reader) {
                console.error("myactivity.json not found");
                return;
            }

            let content = reader.json();

            p.out_archive("google_myactivity_assistant").add_entry_with_string(path, JSON.stringify(content));
            p.out_file("pouet.json").write_string(JSON.stringify(content));

            let w = new alias.Watchers();
            content.filter(i => "audioFiles" in i).forEach(function(i) {
                i.audioFiles.forEach(function(af) {
                    let path = "Takeout/My Activity/Assistant/" + af;
                    w.open(path, on_audio_files);
                });
            });
            return new Alias.WatchersWrapper(w);
        };

        w.open("Takeout/My Activity/Assistant/MyActivity.json", on_index);
    };
}

path["myactivity.search"] = function(scope) {
    return function (w, p) {
        const on_index = function(path, reader) {
            if (!reader) {
                console.error("myactivity.json not found");
            }

            p.out_archive("google_myactivity_search").add_entry_with_reader(path, reader);
        };

        w.open("Takeout/My Activity/Search/MyActivity.json", on_index);
    };
}

module.exports = path;
