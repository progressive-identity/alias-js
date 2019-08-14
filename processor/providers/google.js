let path = {}

path["my_activity.assistant"] = function(scope) {
    return function(w, p) {
        const archive_path = "google_myactivity_assistant";

        const on_audio_files = function(path, reader) {
            if (reader) {
                p.out_archive("google_myactivity_assistant").add_entry_with_reader(path, reader);
            }
        };

        const on_index = function(path, reader) {
            if (!reader) {
                console.error("myactivity.json not found");
                return;
            }

            // XXX streaming json
            let index = reader.json();
            let new_index = [];

            let w = new alias.Watchers();
            for (const i in index) {
                const e = index[i];

                if (!scope.match(e)) {
                    continue;
                }

                if (scope.hasField('audioFiles') && 'audioFiles' in e) {
                    // extract audio files linked to recordings
                    e.audioFiles.forEach(function(af) {
                        let path = "Takeout/My Activity/Assistant/" + af;
                        w.open(path, on_audio_files);
                    });
                }

                // emit indexes
                new_index.push(scope.filterFields(e));
            }

            p.out_archive("google_myactivity_assistant").add_entry_with_string(path, JSON.stringify(new_index));
            return new Alias.WatchersWrapper(w);
        };

        w.open("Takeout/My Activity/Assistant/MyActivity.json", on_index);
    };
}

path["my_activity.search"] = function(scope) {
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
