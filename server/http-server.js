import { logger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";
import * as CallbackUtil from "../global/token-callbacks.js"
import { runAuthenticated } from "../api/do-query.js";
import getQueue, { timeUntil, timeUntilSong } from "../api/queue.js";
import { search } from "../api/search.js";
import songRequest from "../api/song-request.js";
import getDevices, { castPlayback } from "../api/devices.js";
import { TRACK_URI } from "../api/regex.js";
import { getPlaybackState, play, pause, next, previous, seek, setVolume, setShuffle, setRepeat } from "../api/playback.js";
import http from "http";
import { text } from "stream/consumers";
import crypto from "crypto";
import querystring from "querystring";

const LOGIN_TTL_MS = 10 * 60 * 1000;
const MAX_SEARCH_LIMIT = 50;

var state;
var code_verifier;
var login_expires;
var client_id;
var redirect_uri;
var allowed_user_id;
var listen_host;
var api_key;

// Generate a URL-safe random string (used for state and the PKCE code verifier)
function generateRandomString(bytes) {
	return crypto.randomBytes(bytes).toString("base64url");
}

// PKCE code challenge: base64url(sha256(verifier))
function generateCodeChallenge(verifier) {
	return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Constant-time string comparison
function safeEqual(received, expected) {
	if(typeof received !== "string" || typeof expected !== "string") return false;
	const a = Buffer.from(received);
	const b = Buffer.from(expected);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function stateMatches(received) {
	return !!state && safeEqual(received, state);
}

// 127.0.0.0/8 and ::1, including IPv4 addresses mapped into IPv6
function isLoopback(address) {
	return address === "::1" || /^(::ffff:)?127\./.test(address ?? "");
}

function isWildcard(host) {
	return host === "0.0.0.0" || host === "::";
}

// Requests from the network must carry "Authorization: Bearer <API_KEY>"; with no API_KEY they are all refused
function hasApiKey(request) {
	const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? "");
	return !!api_key && safeEqual(match?.[1], api_key);
}

function setSecurityHeaders(response) {
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("Referrer-Policy", "no-referrer");
	response.setHeader("X-Content-Type-Options", "nosniff");
}

// /login GET request endpoint
function login_get(_request, response) {
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

// Fetch the Spotify user id that owns the access token
async function requestUserId(access_token) {
	const request = new RequestBuilder()
		.url("https://api.spotify.com/v1/me")
		.headers( { "Authorization": "Bearer " + access_token } )
		.build();

	const response = await request();
	if(!response.ok) {
		return undefined;
	}
	return (await response.json()).id;
}

function send(response, statusCode, message) {
	if(!response.headersSent) {
		response.writeHead(statusCode, { "Content-Type": "text/plain" });
	}
	response.end(message);
}

function sendJson(response, statusCode, data) {
	if(!response.headersSent) {
		response.writeHead(statusCode, { "Content-Type": "application/json" });
	}
	response.end(JSON.stringify(data));
}

// Log the failure (with optional detail) and respond
function handleError(response, statusCode, message, detail) {
	logger.error(detail ? message + " " + (detail.message || detail) : message);
	send(response, statusCode, message);
}

// Send an API result as JSON. runAuthenticated returns null when Spotify fails;
// true means done with nothing to return, and false means nothing matched
function respond(response, result) {
	if(result === null || result === undefined) {
		return handleError(response, 502, "Spotify request failed.");
	} else if(result === true) {
		response.writeHead(204);
		return response.end();
	} else if(result === false) {
		return send(response, 404, "Not found.");
	}
	sendJson(response, 200, result);
}

// Run an API function with the saved tokens
function authenticated(runnable, args) {
	return runAuthenticated(runnable, CallbackUtil.loadAccessToken(), CallbackUtil.loadRefreshToken(), client_id, args);
}

// Parse a JSON request body, or undefined when it is not JSON
async function jsonBody(request) {
	try   { return JSON.parse(await text(request)); }
	catch { return undefined; 						}
}

// /devices GET request endpoint
async function devices_get(_request, response) {
	respond(response, await authenticated(getDevices));
}

// /cast PUT request endpoint: { "device_id": string, "play"?: boolean }
async function cast_put(request, response) {
	const body = await jsonBody(request);

	if(typeof body?.device_id !== "string" || body.device_id === "") {
		return handleError(response, 400, "Expected a JSON body with a non-empty string device_id.");
	}

	respond(response, await authenticated(castPlayback, [body.device_id, body.play !== false]));
}

// /player GET request endpoint: the current playback state
async function player_get(_request, response) {
	respond(response, await authenticated(getPlaybackState));
}

// /play PUT request endpoint: optional { "device_id"?: string, "uri"?: string }, resumes when empty
async function play_put(request, response) {
	const body = (await jsonBody(request)) ?? {};
	const { device_id, uri } = body;

	if(device_id !== undefined && (typeof device_id !== "string" || device_id === "")) {
		return handleError(response, 400, "device_id must be a non-empty string.");
	} else if(uri !== undefined && !/^spotify:(track|album|playlist|artist|show):[a-zA-Z0-9]+$/.test(uri)) {
		return handleError(response, 400, "uri must be a spotify track, album, playlist, artist or show uri.");
	}

	respond(response, await authenticated(play, [device_id, uri]));
}

// /seek PUT request endpoint: { "position_ms": number }
async function seek_put(request, response) {
	const body = await jsonBody(request);

	if(!Number.isInteger(body?.position_ms) || body.position_ms < 0) {
		return handleError(response, 400, "Expected a JSON body with a non-negative integer position_ms.");
	}

	respond(response, await authenticated(seek, body.position_ms));
}

// /volume PUT request endpoint: { "percent": number } from 0 to 100
async function volume_put(request, response) {
	const body = await jsonBody(request);

	if(!Number.isInteger(body?.percent) || body.percent < 0 || body.percent > 100) {
		return handleError(response, 400, "Expected a JSON body with an integer percent from 0 to 100.");
	}

	respond(response, await authenticated(setVolume, body.percent));
}

// /shuffle PUT request endpoint: { "state": boolean }
async function shuffle_put(request, response) {
	const body = await jsonBody(request);

	if(typeof body?.state !== "boolean") {
		return handleError(response, 400, "Expected a JSON body with a boolean state.");
	}

	respond(response, await authenticated(setShuffle, body.state));
}

// /repeat PUT request endpoint: { "state": "track" | "context" | "off" }
async function repeat_put(request, response) {
	const body = await jsonBody(request);

	if(!["track", "context", "off"].includes(body?.state)) {
		return handleError(response, 400, "Expected a JSON body with state track, context or off.");
	}

	respond(response, await authenticated(setRepeat, body.state));
}

// /request POST request endpoint: { "song": string }, a track uri, link or search text
async function request_post(request, response) {
	const body = await jsonBody(request);
	
	if(typeof body?.song !== "string" || body.song.trim() === "") {
		return handleError(response, 400, "Expected a JSON body with a non-empty string song.");
	}

	const track = await authenticated(songRequest, body.song);
	respond(response, track && track !== true ? { track } : track);
}

// /queue GET request endpoint
async function queue_get(_request, response) {
	respond(response, await authenticated(getQueue));
}

// /time-until GET request endpoint: ?uri=spotify:track:<id>, or ?song=<description> matched against the queue
async function time_until_get(_request, response, url) {
	const uri = url.searchParams.get("uri");
	const song = url.searchParams.get("song");

	if(song?.trim()) {
		return respond(response, await authenticated(timeUntilSong, song));
	} else if(!TRACK_URI.test(uri)) {
		return handleError(response, 400, "Give song, or uri as a spotify:track: uri.");
	}

	const ms = await authenticated(timeUntil, uri);
	respond(response, ms === null || ms === false ? ms : { ms });
}

// /search POST request endpoint: { "query": string, "limit"?: number }
async function search_post(request, response) {
	const body = await jsonBody(request);

	if(typeof body?.query !== "string" || body.query.trim() === "") {
		return handleError(response, 400, "Expected a JSON body with a non-empty string query.");
	}

	const limit = Number.isInteger(body.limit) ? Math.min(Math.max(body.limit, 1), MAX_SEARCH_LIMIT) : 5;
	
	respond(response, await authenticated(search, ["track", encodeURIComponent(body.query), limit]));
}

// /callback GET request endpoint
async function callback(_request, response, url) {
	const code = url.searchParams.get("code");  // The authorization code returned by Spotify
	const responseState = url.searchParams.get("state"); // The state parameter for CSRF protection
	const error = url.searchParams.get("error"); // Set by Spotify if the user denied access

	logger.trace("Checking state");

	// Every callback ends the pending login, so the state/verifier can't be replayed
	const stateOk = stateMatches(responseState) && Date.now() <= login_expires;
	const verifier = code_verifier;
	state = undefined;
	code_verifier = undefined;

	if(!stateOk) {
		handleError(response, 403, "State not accepted or expired.");
	} else if(error) {
		handleError(response, 403, "Authorization denied.", error);
	} else if(code) {
		logger.info("Code OK");
		const data = await requestAccessToken(code, client_id, verifier, redirect_uri);

		if(data.access_token) {
			logger.debug("Access token received");

			const userId = await requestUserId(data.access_token);
			if(!allowed_user_id) {
				logger.warn("No allowed user id configured; tokens not saved. Authorized user id: " + userId);
				return handleError(response, 403, "No allowed Spotify user configured.");
			}
			if(userId !== allowed_user_id) {
				return handleError(response, 403, "Spotify user not allowed.", "got " + userId);
			}

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

// Loopback requests are trusted. The rest need the API key and can't log in, since Spotify
// only redirects back to the loopback REDIRECT_URI
function checkRemote(request, response, pathname, callbackPath) {
	if(isLoopback(request.socket.remoteAddress)) {
		return true;
	}

	if(pathname === "/login" || pathname === callbackPath) {
		send(response, 403, "Log in from the machine running the server.");
		return false;
	}

	if(!hasApiKey(request)) {
		logger.warn("Refused " + request.method + " " + pathname + " from " + request.socket.remoteAddress);
		response.setHeader("WWW-Authenticate", "Bearer");
		send(response, 401, "Unauthorized.");
		return false;
	}

	return true;
}

// The redirect host must stay reachable for the login callback. A wildcard LISTEN_HOST already
// covers it, and binding both would clash
function listenHosts(redirectHost) {
	if(!listen_host || listen_host === redirectHost) {
		return [redirectHost];
	}
	return isWildcard(listen_host) ? [listen_host] : [redirectHost, listen_host];
}

// Create the HTTP server to handle requests
function createServer() {
	const callbackUrl = new URL(redirect_uri);
	const port = callbackUrl.port || 8888;

	const handler = async (request, response) => {
		const parsedUrl = new URL(request.url, "http://" + callbackUrl.host);
		setSecurityHeaders(response);

		try {
			if(!checkRemote(request, response, parsedUrl.pathname, callbackUrl.pathname)) {
				return;
			} else if(request.method === "GET" && parsedUrl.pathname === "/login") {
				login_get(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === callbackUrl.pathname) { // Handle the redirect from Spotify after login
				await callback(request, response, parsedUrl);
			} else if(request.method === "GET" && parsedUrl.pathname === "/queue") {
				await queue_get(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === "/time-until") {
				await time_until_get(request, response, parsedUrl);
			} else if(request.method === "POST" && parsedUrl.pathname === "/search") {
				await search_post(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === "/devices") {
				await devices_get(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/cast") {
				await cast_put(request, response);
			} else if(request.method === "POST" && parsedUrl.pathname === "/request") {
				await request_post(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === "/player") {
				await player_get(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/play") {
				await play_put(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/pause") {
				respond(response, await authenticated(pause));
			} else if(request.method === "POST" && parsedUrl.pathname === "/next") {
				respond(response, await authenticated(next));
			} else if(request.method === "POST" && parsedUrl.pathname === "/previous") {
				respond(response, await authenticated(previous));
			} else if(request.method === "PUT" && parsedUrl.pathname === "/seek") {
				await seek_put(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/volume") {
				await volume_put(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/shuffle") {
				await shuffle_put(request, response);
			} else if(request.method === "PUT" && parsedUrl.pathname === "/repeat") {
				await repeat_put(request, response);
			} else if(request.method === "GET" && parsedUrl.pathname === "/") {
				send(response, 200, "Visit /login to start the authorization flow.");
			} else {
				send(response, 404, "Not found.");
			}
		} catch(err) {
			handleError(response, 500, "Internal server error.", err);
		}
	};

	const hosts = listenHosts(callbackUrl.hostname);
	if(hosts.some(host => !isLoopback(host)) && !api_key) {
		logger.warn("LISTEN_HOST is set without API_KEY; requests from the network will be refused.");
	}

	for(const host of hosts) {
		http.createServer(handler).listen(port, host, () => {
			console.log("Server running at http://" + host + ":" + port);
		});
	}
}

export default function start(clientId, redirectUri, allowedUserId, listenHost, apiKey) {
	client_id = clientId;
	redirect_uri = redirectUri;
	allowed_user_id = allowedUserId;
	listen_host = listenHost;
	api_key = apiKey;
	createServer();
}