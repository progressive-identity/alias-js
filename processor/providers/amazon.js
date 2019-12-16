const proc = new Processor({
    name: "Amazon",
    url: "https://amazon.com/",
});

proc.path("alexa")
    .desc("Amazon Alexa requests history")
;

module.exports = proc;
