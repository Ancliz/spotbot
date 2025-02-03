import { logger } from "../global/global.js";
import RequestBuilder, { BadRequestException, httpException, HttpStatus, NotFoundException, UnauthorizedException } from "../global/requests-util.js";


export default async function songRequest(token, url) {
	let qurl = "https://api.spotify.com/v1/me/player/queue?uri=" + getUri(url);

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
	} else if(response.status === HttpStatus.NOT_FOUND) {
		const error = (await response.json()).error;
		logger.error(error);
		throw new NotFoundException(error.message);
	} else if(response.status === HttpStatus.BAD_REQUEST) {
		logger.error(await response.text());
		throw new BadRequestException();
	} else {
		throw httpException(response.status, "Error adding song to queue");
	}

}

function getUri(url) {
	if(/^spotify:track:[a-zA-z0-9]+$/.test(url)) {
		return url;
	} else if(/https:\/\/open\.spotify\.com\/track\//.test(url)) {
		return "spotify:track:" + url.match(/(?<=track\/)[a-zA-Z0-9]+(?=\?|[a-zA-Z0-9]*)/);
	}
}