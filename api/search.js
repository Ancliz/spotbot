import RequestBuilder, { BadRequestException, httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js";
import { TRACK_ID, TRACK_URI, TRACK_URL } from "./regex.js";
import { logger } from "../global/global.js"

export async function search(token, args) {
    let url = `https://api.spotify.com/v1/search?type=${args[0]}&q=${args[1]}&limit=${args[2]}`;

    const request = new RequestBuilder()
        .url(url)
        .headers({ "Authorization": `Bearer ${token}` })
        .build();

    const response = await request();
    const result = await response.json();
    logger.info("Searching: " + args);
    if(response.status === HttpStatus.OK) {
        return result.tracks.items;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException();
    } else if(response.status === HttpStatus.BAD_REQUEST) {
        throw new BadRequestException(result.error.message);
    } else {
        throw httpException(response.status, result.error.message);
    }

}

export async function getTrack(token, uri) {
    const id = uri.match(TRACK_ID);
    const request = new RequestBuilder()
        .url(`https://api.spotify.com/v1/tracks/${id}`)
        .headers({ "Authorization": `Bearer ${token}` })
        .build();
    const response = await request();
    const data = await response.json();
    if(response.status === HttpStatus.OK) {
        return data;
    } else {
        throw httpException(response.status, data.error.message);
    }
}

export async function getUri(token, url) {
	if(TRACK_URI.test(url)) {
		return url;
	} else if(TRACK_URL.test(url)) {
		return "spotify:track:" + url.match(TRACK_ID);
	} else {
        let uri = (await search(token, ["track", url, 1]))[0].uri;
        logger.info("Found uri: " + uri);
        return uri;
	}
}