const fs = require('fs');
const path = require('path');

// read base folder for configuration and secret keys

const configFolderPath = process.env.ALIAS_PROVIDER_CONFIG || "/config/"
const configPath = path.join(configFolderPath, "provider.config.json");

// if no configuration file exists, generate one
if (!fs.existsSync(configPath)) {
    let cookieSecret = [];
    for (let i=0; i<64; ++i) {
            cookieSecret.push(Math.floor(Math.random()*256));
    }
    cookieSecret = Buffer.from(new Uint8Array(cookieSecret)).toString("base64");

    const config = {
        "http": {
            "listenPort": 80,
            "cookieSecret": cookieSecret,
        },

        "storage": {},

        "redis": {
            "host": "redis.provider.alias"
        },

        "processor": [
            {
                "url": "ws://processor.provider.alias/"
            }
        ]
    };

    const configJSON = JSON.stringify(config, null, 4);
    console.log("create default configuration file.");
    if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath);
    }
    fs.writeFileSync(configPath, configJSON);
}

module.exports = require(configPath);
