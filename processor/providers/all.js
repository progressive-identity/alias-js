function get(provider) {
    if (provider == "google") {
        return require("./google.js");
    } else {
        return null;
    }
}

module.exports.get = get;
