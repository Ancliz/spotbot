import { logger } from "../global/global.js";
import RequestBuilder, { BadRequestException, httpException, HttpStatus, NotFoundException, UnauthorizedException } from "../global/requests-util.js";
import { getUri, getTrack } from "./search.js";

export default async function songRequest(token, url) {
	const uri = await getUri(token, url);
	let qurl = "https://api.spotify.com/v1/me/player/queue?uri=" + uri;

	const request = new RequestBuilder()
		.url(qurl)
		.method("POST")
		.headers({ "Authorization": `Bearer ${token}` })
		.build();
		
	const response = await request();
	if(response.status === HttpStatus.OK) {
		logger.info("Song added to queue");
		return await getTrack(token, uri);
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