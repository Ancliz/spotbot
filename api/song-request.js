import { logger } from "../global/global.js";
import RequestBuilder, { BadRequestException, httpException, HttpStatus, NotFoundException, UnauthorizedException } from "../global/requests-util.js";
import { TRACK_ID, TRACK_URI, TRACK_URL } from "./regex.js";
import { getTrack, search } from "./search.js";

/**
 * Queue a track given as a spotify:track: uri, an open.spotify.com link or search text.
 * @returns {Promise<object | false>} the queued track, or false when nothing matches
 */
export default async function songRequest(token, url) {
	const track = await getTrackFor(token, url);

	if(!track) {
		return false;
	}

	let qurl = "https://api.spotify.com/v1/me/player/queue?uri=" + encodeURIComponent(track.uri);

	const request = new RequestBuilder()
		.url(qurl)
		.method("POST")
		.headers({"Authorization": `Bearer ${token}`})
		.build();
		
	const response = await request();
	if(response.status === HttpStatus.OK || response.status === HttpStatus.NO_CONTENT) {
		logger.info("Song added to queue");
		return track;
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

async function getTrackFor(token, url) {
	if(TRACK_URI.test(url)) {
		return await getTrack(token, url);
	} else if(TRACK_URL.test(url)) {
		return await getTrack(token, "spotify:track:" + url.match(TRACK_ID));
	} else {
		return (await search(token, ["track", encodeURIComponent(url), 1]))[0];
	}
}