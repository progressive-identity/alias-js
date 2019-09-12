const proc = new Processor({
    name: "Facebook",
    url: "https://facebook.com/",
});

proc.path("friends")
    .desc("Facebook's friends")
    .handler(ctx => {
        ctx.open("friends/friends.json", (path, reader) => {
            console.log("friends/friends.json", path, reader);
            if (!reader) { return; }

            console.log("debug 1");
            const index = reader.json();
            console.log("debug 2", index.length);
            const indexFilter = ctx.filter(index);
            console.log("debug 3", indexFilter.length);
            ctx.write(path, indexFilter);
            console.log("debug 4");
        });
    })
;

module.exports = proc;
