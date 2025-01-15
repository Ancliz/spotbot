import { RequestBuilder } from "./requests-util.js";

var client_id =  process.env.CLIENT_ID; //"4c298577fae54b3bb4cb3f1a6e7e74b4"
var client_secret = process.env.CLIENT_SECRET; //"a75afb733ea54fd59eabd87798e82f7c"

const url = "https://accounts.spotify.com/api/token";

const request = new RequestBuilder()
  .url(url)
  .method("POST")
  .headers( {
    "Authorization": "Basic " + (new Buffer.from(client_id + ":" + client_secret).toString("base64")),
    "Content-Type": "application/x-www-form-urlencoded"
  })
  .body("grant_type=client_credentials")
  .build();

async function run() {
  const response = await request();
  const body = await response.json();

  // Send the response status code to %output#%
  console.log(response.status);
  console.log(body.access_token);
}

run();