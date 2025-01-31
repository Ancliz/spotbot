import { logger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";
import * as CallbackUtil from "../global/token-callbacks.js"
import http from "http";
import url from "url";
import querystring from "querystring";

var state;
var client_id;
var client_secret;
var redirect_uri;

// Generate a random string for state
function generateRandomString(length) {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	let indices = new Uint32Array(length);
	crypto.getRandomValues(indices);

	logger.trace("Generating state");

	for(let i = 0; i < length; ++i) {
		result += characters.charAt(Math.floor(indices[i] / (0xFFFFFFFF + 1) * characters.length));
	}

	logger.debug("State: " + result);
	return result;
}

// /login GET request endpoint
function login_get(request, response) {
	state = generateRandomString(16);
	const scope = "user-read-private user-read-email user-read-currently-playing user-modify-playback-state";
	const spotifyAuthUrl = "https://accounts.spotify.com/authorize?" + querystring.stringify({
		response_type: "code",
		client_id: client_id,
		scope: scope,
		redirect_uri: redirect_uri,
		state: state
	});

	// Redirect the user to Spotify's authorization page
	response.writeHead(302, { "Location": spotifyAuthUrl });
	response.end();
}

// Exchange the authorization code for an access token
async function requestAccessToken(code, client_id, client_secret, redirect_uri) {
	logger.debug("Building access token request data");

	const data = querystring.stringify({
		grant_type: "authorization_code",
		code: code,
		redirect_uri: redirect_uri,
		client_id: client_id,
		client_secret: client_secret
	});

	logger.trace("Building access token request");

	const request = new RequestBuilder()
		.url("https://accounts.spotify.com/api/token")
		.method("POST")
		.headers( { "Content-Type": "application/x-www-form-urlencoded" } )
		.body(data)
		.build();
	
	logger.trace("POSTING for access token");

	const response = await request();
	return await response.json();
}

// /callback GET request endpoint
async function callback(request, response, url) {
	const code = url.query.code;  // The authorization code returned by Spotify
	const responseState = url.query.state; // The state parameter for CSRF protection

	logger.trace("Checking state");

	if(responseState !== state) {
		logger.error("State not accepted. " + state + " received: " + responseState);
		response.writeHead(403, {"Content-Type": "text/plain"});
		response.end("State not accepted.");
	} else if(code) {
		logger.debug("Code OK");
		const data = await requestAccessToken(code, client_id, client_secret, redirect_uri);

		if(data.access_token) {
			logger.debug("Access Token: " + data.access_token);
			CallbackUtil.saveAccessToken(data.access_token);
			CallbackUtil.saveRefreshToken(data.refresh_token);
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end("Authorization successful!");
		}
	} else {
		logger.error("Access token not received.");
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
			console.log("Server running at http://localhost:8888");
	});
}

export default function start(clientId, clientSecret, redirectUri) {
	client_id = clientId;
	client_secret = clientSecret;
	redirect_uri = redirectUri;
	createServer();
}