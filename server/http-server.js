import { logger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";
import * as CallbackUtil from "../global/token-callbacks.js"
import http from "http";
import crypto from "crypto";
import querystring from "querystring";

const LOGIN_TTL_MS = 10 * 60 * 1000;

var state;
var code_verifier;
var login_expires;
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

function stateMatches(received) {
	if(!state || typeof received !== "string") return false;
	const a = Buffer.from(received);
	const b = Buffer.from(state);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setSecurityHeaders(response) {
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Content-Type-Options", "nosniff");
}

// /login GET request endpoint
function login_get(request, response) {
	state = generateRandomString(32);
	code_verifier = generateRandomString(64);
	login_expires = Date.now() + LOGIN_TTL_MS;
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

// Discard the pending login so the state/verifier can't be replayed
function clearPendingLogin() {
	state = undefined;
	code_verifier = undefined;
}

function send(response, statusCode, message) {
	if(!response.headersSent) {
		response.writeHead(statusCode, { "Content-Type": "text/plain" });
	}
	response.end(message);
}

// Log the failure (with optional detail), end the pending login and respond
function handleError(response, statusCode, message, detail) {
	logger.error(detail ? message + " " + (detail.message || detail) : message);
	clearPendingLogin();
	send(response, statusCode, message);
}

// /callback GET request endpoint
async function callback(request, response, url) {
	const code = url.searchParams.get("code");  // The authorization code returned by Spotify
	const responseState = url.searchParams.get("state"); // The state parameter for CSRF protection
	const error = url.searchParams.get("error"); // Set by Spotify if the user denied access

	logger.trace("Checking state");

	if(!stateMatches(responseState) || Date.now() > login_expires) {
		handleError(response, 403, "State not accepted or expired.");
	} else if(error) {
		handleError(response, 403, "Authorization denied.", error);
	} else if(code) {
		logger.info("Code OK");

		const verifier = code_verifier;
		clearPendingLogin();
		const data = await requestAccessToken(code, client_id, verifier, redirect_uri);

		if(data.access_token) {
			logger.debug("Access token received");
			CallbackUtil.saveAccessToken(data.access_token);
			CallbackUtil.saveRefreshToken(data.refresh_token);
			send(response, 200, "Authorization successful!");
		} else {
			handleError(response, 502, "Token exchange failed.", data.error || "unknown error");
		}
	} else {
		handleError(response, 400, "Authorization code not received.");
	}
}

// Create the HTTP server to handle requests
function createServer() {
	const callbackUrl = new URL(redirect_uri);
	const port = callbackUrl.port || 8888;

	http.createServer(async (request, response) => {
		const parsedUrl = new URL(request.url, "http://" + callbackUrl.host);
		setSecurityHeaders(response);
		
		try {
			if(request.method === "GET" && parsedUrl.pathname === "/login") {
				login_get(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === callbackUrl.pathname) { // Handle the redirect from Spotify after login
				await callback(request, response, parsedUrl);
			} else {
				send(response, 200, "Visit /login to start the authorization flow.");
			}
		} catch(err) {
			handleError(response, 500, "Internal server error.", err);
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