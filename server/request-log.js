import { logger } from "../global/global.js";
import { createSink, logConfig } from "../global/log-config.js";

const REDACTED = "[redacted]";
const SECRET_HEADERS = ["authorization", "cookie", "set-cookie"];
const SECRET_PARAMS = ["code", "state"];
const MAX_BODY = 64 * 1024;

const config = logConfig("requests");
var sinks;

export function isLogging() {
	return !!sinks;
}

// The files being written to by file sinks
export function logFiles() {
	return (sinks ?? []).map(sink => sink.path).filter(Boolean);
}

// Start writing to each of the request log's sinks. File sinks start a fresh file
export function startLogging() {
	if(!sinks) {
		sinks = config.sinks.map((spec, i) => createSink(spec, `requests.sinks[${i}]`, "requests"));
		logger.info("Logging requests to " + (logFiles().join(", ") || sinks.length + " sink(s)"));
	}
	return logFiles();
}

// Stop logging. The files are kept
export function stopLogging() {
	const stopped = logFiles();
	if(sinks) logger.info("Stopped logging requests");
	sinks = undefined;
	return stopped;
}

// Start logging when the config enables it
export function startIfEnabled() {
	if(config.enabled) startLogging();
}

function redactHeaders(headers) {
	const copy = { ...headers };
	for(const name of SECRET_HEADERS) {
		if(copy[name] !== undefined) copy[name] = REDACTED;
	}
	return copy;
}

function redactUrl(url) {
	const copy = new URL(url);
	for(const name of SECRET_PARAMS) {
		if(copy.searchParams.has(name)) copy.searchParams.set(name, REDACTED);
	}
	return copy.pathname + copy.search;
}

function truncate(body) {
	return body.length > MAX_BODY ? body.slice(0, MAX_BODY) + "…[truncated]" : body;
}

/**
 * Capture the response body and, once it is sent, append the request and response to the log.
 * @param {http.IncomingMessage} request with the raw body in request.body
 * @param {http.ServerResponse} response
 * @param {URL} url the parsed request url
 */
export function capture(request, response, url) {
	if(!sinks) {
		return;
	}

	const started = Date.now();
	const chunks = [];
	const write = response.write.bind(response);
	const end = response.end.bind(response);

	const collect = chunk => {
		if(chunk !== undefined && typeof chunk !== "function") chunks.push(Buffer.from(chunk));
	};

	response.write = (chunk, ...rest) => {
		collect(chunk);
		return write(chunk, ...rest);
	};
	response.end = (chunk, ...rest) => {
		collect(chunk);
		return end(chunk, ...rest);
	};

	response.once("finish", () => {
		const entry = {
			log: "requests",
			time: new Date(started).toISOString(),
			ms: Date.now() - started,
			remote: request.socket.remoteAddress,
			request: {
				method: request.method,
				url: redactUrl(url),
				headers: redactHeaders(request.headers),
				body: truncate(request.body ?? "")
			},
			response: {
				status: response.statusCode,
				headers: redactHeaders(response.getHeaders()),
				body: truncate(Buffer.concat(chunks).toString("utf8"))
			}
		};

		const line = JSON.stringify(entry) + "\n";
		for(const sink of sinks ?? []) sink.write(line);
	});
}