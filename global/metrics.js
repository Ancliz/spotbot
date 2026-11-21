import client from "prom-client";

// Process metrics: CPU, memory, event loop lag, GC and so on
client.collectDefaultMetrics();

export const registry = client.register;

const httpRequests = new client.Counter({
	name: "http_requests_total",
	help: "HTTP requests handled, by method, route and status",
	labelNames: ["method", "route", "status"]
});

const httpDuration = new client.Histogram({
	name: "http_request_duration_seconds",
	help: "Time to handle an HTTP request, by method and route",
	labelNames: ["method", "route"],
	buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

const tokenRefreshes = new client.Counter({
	name: "spotify_token_refreshes_total",
	help: "Spotify access token refreshes, by result",
	labelNames: ["result"]
});

const spotifyErrors = new client.Counter({
	name: "spotify_api_errors_total",
	help: "Errors from Spotify API calls, by error type",
	labelNames: ["type"]
});

// Start both at zero so rate() and alerts work before the first refresh
for(const result of ["success", "failure"]) tokenRefreshes.inc({ result: result }, 0);

/**
 * Time a request and count it once the response is sent.
 * @param {string} route a fixed route name, never the raw path, to keep the label set small
 */
export function observeRequest(request, response, route) {
	const end = httpDuration.startTimer({ method: request.method, route: route });

	response.once("finish", () => {
		end();
		httpRequests.inc({ method: request.method, route: route, status: response.statusCode });
	});
}

export function countTokenRefresh(ok) {
	tokenRefreshes.inc({ result: ok ? "success" : "failure" });
}

export function countSpotifyError(error) {
	spotifyErrors.inc({ type: error?.name || "Error" });
}