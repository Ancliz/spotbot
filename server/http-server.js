import { serverLogger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";
import * as CallbackUtil from "../global/token-callbacks.js"
import http from "http";
import url from "url";
import querystring from "querystring";

var state;
var client_id;
var client_secret;
var redirect_uri;
const codeVerifier = generateRandomString(64);

function generateRandomString(length) {
	const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
	const values = crypto.getRandomValues(new Uint8Array(length));
	return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

async function sha256(plain) {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return crypto.subtle.digest("SHA-256", data);
}

function base64encode(input) {
	return btoa(String.fromCharCode(...new Uint8Array(input)))
	  .replace(/=/g, '')
	  .replace(/\+/g, '-')
	  .replace(/\//g, '_');
}


// /login GET request endpoint
async function login_get(request, response) {
	state = generateRandomString(16);
	serverLogger.debug("state: " + state);
	const hashed = await sha256(codeVerifier)
	const codeChallenge = base64encode(hashed);
	
	const scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
	const spotifyAuthUrl = "https://accounts.spotify.com/authorize?" + querystring.stringify({
		response_type: "code",
		client_id: client_id,
		scope: scope,
		redirect_uri: redirect_uri,
		code_challenge_method: "S256",
		code_challenge: codeChallenge,
		state: state
	});

	// Redirect the user to Spotify's authorization page
	response.writeHead(302, { "Location": spotifyAuthUrl });
	response.end();
}

// Exchange the authorization code for an access token
async function requestAccessToken(code, client_id, client_secret, redirect_uri) {
	serverLogger.debug("Building access token request data");

	const data = querystring.stringify({
		grant_type: "authorization_code",
		code: code,
		redirect_uri: redirect_uri,
		client_id: client_id,
		client_secret: client_secret,
		code_verifier: codeVerifier
	});

	serverLogger.trace("Building access token request");

	const request = new RequestBuilder()
		.url("https://accounts.spotify.com/api/token")
		.method("POST")
		.headers( { "Content-Type": "application/x-www-form-urlencoded" } )
		.body(data)
		.build();
	
	serverLogger.info("POSTING for access token");

	const response = await request();
	return await response.json();
}

// /callback GET request endpoint
async function callback(request, response, url) {
	const code = url.query.code;  // The authorization code returned by Spotify
	const responseState = url.query.state; // The state parameter for CSRF protection

	serverLogger.trace("Checking state");

	if(responseState !== state) {
		serverLogger.error("State not accepted. " + state + " received: " + responseState);
		response.writeHead(403, {"Content-Type": "text/plain"});
		response.end("State not accepted.");
	} else if(code) {
		serverLogger.debug("Code OK");
		const data = await requestAccessToken(code, client_id, client_secret, redirect_uri);

		if(data.access_token) {
			serverLogger.debug("Access Token: " + data.access_token);
			CallbackUtil.saveAccessToken(data.access_token);
			CallbackUtil.saveRefreshToken(data.refresh_token);
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end("Authorization successful!");
		}
	} else {
		serverLogger.error("Access token not received.");
		response.writeHead(400, { "Content-Type": "text/plain" });
		response.end("Access token not received.");
	}
}

// Create the HTTP server to handle requests
function createServer() {
	http.createServer(async (request, response) => {
		const parsedUrl = url.parse(request.url, true);
		
		if(request.method === "GET" && parsedUrl.pathname === "/login") {
			login_get(request, response);
		} else if(request.method === "GET" && parsedUrl.pathname === "/callback") { // Handle the redirect from Spotify after login
			callback(request, response, parsedUrl);
		} else {
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end("Visit /login to start the authorization flow.");
		}
	}).listen(8888, () => {
			serverLogger.info("Server running at http://localhost:8888");
	});
}

export default function start(clientId, clientSecret, redirectUri) {
	client_id = clientId;
	client_secret = clientSecret;
	redirect_uri = redirectUri;
	createServer();
}