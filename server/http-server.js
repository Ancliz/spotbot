import { logger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";
import * as CallbackUtil from "../global/token-callbacks.js"
import http from "http";
import url from "url";
import crypto from "crypto";
import querystring from "querystring";

var state;
var code_verifier;
var client_id;
var redirect_uri;

// Generate a URL-safe random string (used for state and the PKCE code verifier)
function generateRandomString(bytes) {
	return crypto.randomBytes(bytes).toString("base64url");
}

// PKCE code challenge: base64url(sha256(verifier))
function generateCodeChallenge(verifier) {
	return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// /login GET request endpoint
function login_get(request, response) {
	state = generateRandomString(32);
	code_verifier = generateRandomString(64);
	const scope = "user-read-currently-playing user-read-playback-state user-modify-playback-state";
	const spotifyAuthUrl = "https://accounts.spotify.com/authorize?" + querystring.stringify({
		response_type: "code",
		client_id: client_id,
		scope: scope,
		redirect_uri: redirect_uri,
		state: state,
		code_challenge_method: "S256",
		code_challenge: generateCodeChallenge(code_verifier)
	});

	// Redirect the user to Spotify's authorization page
	response.writeHead(302, { "Location": spotifyAuthUrl });
	response.end();
}

// Exchange the authorization code for an access token
async function requestAccessToken(code, client_id, code_verifier, redirect_uri) {
	logger.debug("Building access token request data");

	const data = querystring.stringify({
		grant_type: "authorization_code",
		code: code,
		redirect_uri: redirect_uri,
		client_id: client_id,
		code_verifier: code_verifier
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

	if(!state || responseState !== state) {
		logger.error("State not accepted.");
		response.writeHead(403, {"Content-Type": "text/plain"});
		response.end("State not accepted.");
	} else if(code) {
		logger.debug("Code OK");
		const verifier = code_verifier;
		// Single use: clear so the state/verifier can't be replayed
		state = undefined;
		code_verifier = undefined;
		const data = await requestAccessToken(code, client_id, verifier, redirect_uri);

		if(data.access_token) {
			logger.debug("Access token received");
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
	const callbackUrl = new URL(redirect_uri);
	const port = callbackUrl.port || 8888;

	http.createServer(async (request, response) => {
		const parsedUrl = url.parse(request.url, true);
		
		if(request.method === "GET" && parsedUrl.pathname === "/login") {
			login_get(request, response);
		} else if(request.method === "GET" && parsedUrl.pathname === callbackUrl.pathname) { // Handle the redirect from Spotify after login
			callback(request, response, parsedUrl);
		} else {
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end("Visit /login to start the authorization flow.");
		}
	}).listen(port, callbackUrl.hostname, () => {
			console.log("Server running at http://" + callbackUrl.hostname + ":" + port);
	});
}

export default function start(clientId, redirectUri) {
	client_id = clientId;
	redirect_uri = redirectUri;
	createServer();
}