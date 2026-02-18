const {
  console,
  menu,
  event,
  core,
  mpv,
  preferences,
  http,
} = iina;

console.log("Plugin is running");

const { CryptoJS } = require("./CryptoJS/md5.js");


var username = preferences.get("username");
var password = preferences.get("password");
var apiKey = preferences.get("apiKey");
var apiSecret = preferences.get("apiSecret");
var scrobbleThis = true;
var scrobbledThis = false;

var startTime;

var currentTitle;
var currentArtist;
var currentAlbum;
var duration;
var halfDuration;
var position;

var sessionKey;

// const parser = new DOMParser();

async function generateSession(){
  let sig = CryptoJS.MD5(`api_key${apiKey}methodauth.getMobileSessionpassword${password}username${username}${apiSecret}`);
  let url = `https://ws.audioscrobbler.com/2.0/?method=auth.getMobileSession&password=${encodeURIComponent(password)}&username=${encodeURIComponent(username)}&api_key=${encodeURIComponent(apiKey)}&format=json&api_sig=${encodeURIComponent(sig)}`;
  console.log(url);
  const sessionResponse = await http.post(url);
  console.log(`Session Key Status: ${sessionResponse.statusCode}: ${sessionResponse.reason}`);
  let sessionDocument = JSON.parse(sessionResponse.text);
  sessionKey = sessionDocument["session"]["key"];
}

const loadWindow = event.on("iina.window-loaded", () => {
  console.log("starting to get session");
  generateSession().then(result => {
    console.log("Session Key Sequence Finished.");
  })
})


async function scrobble(){

  let albumText = currentAlbum ? `&album=${encodeURIComponent(currentAlbum)}` : "";
  let albumSig = currentAlbum ? `album${currentAlbum}` : "";
  let rawSigString = `${albumSig}api_key${apiKey}artist${currentArtist}methodtrack.scrobblesk${sessionKey}timestamp${startTime}track${currentTitle}${apiSecret}`;
  let sigString = CryptoJS.MD5(rawSigString);

  let url = `https://ws.audioscrobbler.com/2.0/?method=track.scrobble&format=json&artist=${encodeURIComponent(currentArtist)}&track=${encodeURIComponent(currentTitle)}${albumText}&timestamp=${encodeURIComponent(startTime)}&api_key=${encodeURIComponent(apiKey)}&sk=${encodeURIComponent(sessionKey)}&api_sig=${encodeURIComponent(sigString)}`;
  console.log(url);

  const result = await http.post(url);
  console.log(`Scrobble Status: ${result.statusCode}: ${sessionResponse.reason}`);
  return JSON.parse(result.text);
}

const startFile = event.on("iina.file-loaded", () => {
  currentTitle = mpv.getString("metadata/by-key/Title");
  if (!currentTitle) currentTitle = mpv.getString("metadata/by-key/title");
    if (!currentTitle) currentTitle = mpv.getString("metadata/by-key/TITLE");
  currentArtist = mpv.getString("metadata/by-key/Artist");
  if (!currentArtist) currentArtist = mpv.getString("metadata/by-key/artist");
  if (!currentArtist) currentArtist = mpv.getString("metadata/by-key/ARTIST");
  currentAlbum = mpv.getString("metadata/by-key/Album");
  if (!currentAlbum) currentAlbum = mpv.getString("metadata/by-key/album");
  if (!currentAlbum) currentAlbum = mpv.getString("metadata/by-key/ALBUM");
  // assume that if title and artist are present, this is a song
  if (!currentTitle || !currentArtist){
    console.log("This is not a song, or at least it is missing metadata that would allow it to be scrobbled.");
    scrobbleThis = false;
    return
  }
  console.log("Song: " + currentTitle + " by " + currentArtist + " in " + currentAlbum);
  duration = core.status.duration;
  if (duration < 30){
    console.log("Song is less than 30 seconds.")
    scrobbleThis = false;
    return
  }
  halfDuration = duration/2;
  scrobbleThis = true;
  scrobbledThis = false;
  startTime = Date.now()/1000
})

const periodic = event.on("mpv.time-pos.changed", () =>{
  if (!scrobbleThis || scrobbledThis || !sessionKey) return;
  position = core.status.position;
  console.log(`Progress: ${position} out of ${halfDuration}`);
  if (position < halfDuration) return;
  console.log(`time to scrobble!`)
  scrobble().then(result => {
    console.log("Scrobble Sequence Finished.")
  })
  scrobbledThis = true;
})


