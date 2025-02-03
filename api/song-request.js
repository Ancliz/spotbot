import { logger } from "../global/global.js";
import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js";


export default async function songRequest(token, url) {
	const uri = url.match(/(?<=track\/)[a-zA-Z0-9]+(?=\?|[a-zA-Z0-9]*)/);
	let qurl = "https://api.spotify.com/v1/me/player/queue?uri=spotify:track:" + uri;

	const request = new RequestBuilder()
		.url(qurl)
		.method("POST")
		.headers({"Authorization": `Bearer ${token}`})
		.build();
		
	const response = await request();
	if(response.status === HttpStatus.OK) {
		logger.info("Song added to queue");
	} else if(response.status === HttpStatus.UNAUTHORIZED) {
		throw new UnauthorizedException();
	} else {
		throw httpException(response.status, "Error adding song to queue");
	}

}