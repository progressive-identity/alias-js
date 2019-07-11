const jsfile = require('./jsfile.js');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '../data/token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {

}

function getHandler() {
    return new Promise((resolve, reject) => {
        fs.readFile('../credentials.json', (err, content) => {
            if (err) {
                reject('Error loading client secret file: ' + err);
                return;
            }

            authorize(JSON.parse(content), (handler) => {
                resolve(handler);
            });
        });
    });
}

async function list(drive, caller_args) {
    const args = {
        q: "name contains 'takeout-' and (name contains '.zip' or name contains '.tgz')",
        //q: "name contains 'debug'",
        spaces: "drive",
        //fields: 'nextPageToken, files(*)',
        fields: 'nextPageToken, files(id, name, modifiedTime, size)',
        orderBy: 'modifiedTime desc',
    };

    const res = await drive.files.list({...caller_args, ...args});

    return res.data.files;
};

function getDownloadRequest(auth, fileId) {
    return {
        url: "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media",
        args: {
            headers: {
                'Authorization': 'Bearer ' + auth.credentials.access_token,
            }
        },
    }
}
/*
function newSyncReader(auth, fileId) {
    const url = "https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media";
    const headers = {
        'Authorization': 'Bearer ' + auth.credentials.access_token,
    };
    const handler = new jsfile.UrlReaderSync(url, {
        'headers': headers
    });

    return handler;
}*/

module.exports.getHandler = getHandler;
module.exports.list = list;
module.exports.getDownloadRequest = getDownloadRequest;
