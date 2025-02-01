import { logger } from "../global/global.js";
import RequestBuilder from "../global/requests-util.js";

var qurl = "https://api.spotify.com/v1/me/player/queue?uri=spotify:track:"

export default async function songRequest(url, token) {
	const uri = url.match(/(?<=track\/)[a-zA-Z0-9]+(?=\?|[a-zA-Z0-9]*)/);
	qurl += uri;
	const request = new RequestBuilder()
		.url(qurl)
		.method("POST")
		.headers({"Authorization": `Bearer ${token}`})
		.build();
		
	const response = await request();
	logger.debug(response.status);
	logger.info("Song added to queue");
}