const proc = new Processor({
    name: "Google",
    url: "https://myaccount.google.com/",
});

proc.path("my_activity.assistant")
    .desc("Google Assistant requests history")
    .handler(ctx => {
        ctx.open("Takeout/My Activity/Assistant/MyActivity.json", (path, reader) => {
            if (!reader) { return; }

            const index = ctx.filter(reader.json());
            ctx.write(path, index);

            for (const e of index) {
                for (const af of e.audioFiles||[]) {
                    ctx.copy("Takeout/My Activity/Assistant/" + af);
                }
            }
        });
    })
    .model("Takeout/My Activity/Assistant/MyActivity.json", {
        summary: "History of interactions with Google assistant",
        description: "List of past interactions of an user with its Google Assistant",
        contentType: "application/json",
        schema: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    "title": {
                        type: "string",
                        description: "Interaction title. Contains the user's voice transcript.",
                        example: "Said What\u0027s the weather?",
                    },
                    "titleURL": {
                        type: "string",
                        description: "Google Search URL for the user's interaction",
                        example: "https://www.google.com/search?q\u003dWhat%27s+the+weather%3F",
                    },
                    "subtitles": {
                        type: "array",
                        items: {
                            name: {
                                type: "string",
                                description: "Google Assistant's response",
                                example: "Right now in Paris it\u0027s forty-nine and partly cloudy.",
                            },
                        },
                    },
                    "time": {
                        type: "string",
                        format: "date-time",
                    },
                    "locationInfos": {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                "name": {
                                    type: "string",
                                    description: "English description about the current location.",
                                    example: "Around this area",
                                },
                                "url": {
                                    type: "string",
                                    description: "Google Maps URL of the location.",
                                    example: "https://www.google.com/maps/@?api\u003d1\u0026map_action\u003dmap\u0026center\u003d48.845947,2.354853\u0026zoom\u003d12",
                                },
                                "source": {
                                    type: "string",
                                    description: "English description about the current location.",
                                    example: "From your device",
                                },
                            },
                        },
                    },
                    "details": {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                "name": {
                                    type: "string",
                                    description: "English description of how the the assistant were invoked",
                                    example: "Started by hotword",
                                },
                            },
                        },
                    },
                    "audioFiles": {
                        type: "array",
                        items: {
                            type: "string",
                            description: "Filename of the MP3-encoded audio recordings",
                        },
                    },
                },
            },
        },
    })
    .model("Takeout/My Activity/Assistant/{filename}.mp3", {
        summary: "Audio recordings with Google Assistant",
        description: "Raw recordings from the Google Assistant device during the user's interaction with Google Assistant",
        contentType: "audio/mpeg3",
    })
;

proc.path("my_activity.search")
    .desc("Google Search")
    .handler(ctx => {
        ctx.open("Takeout/My Activity/Search/MyActivity.json", (path, reader) => {
            if (!reader) { return; }
            ctx.write(path, ctx.filter(reader.json()));
        });
    })
;

proc.path("my_account.email")
    .desc("Google email")
;

proc.path("my_account.connection_history")
    .desc("Google Connection History")
;

module.exports = proc;
