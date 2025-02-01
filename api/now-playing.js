import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js"
import { logger } from "../global/global.js";

/**
 * @param {string} token 
 * @returns {string} the formatted title and artists of the song currently playing
 */
export default async function nowPlaying(token) {
	const request = new RequestBuilder()
		.url("https://api.spotify.com/v1/me/player/currently-playing")
		.headers( { "Authorization": `Bearer ${token}` } )
		.build();
		
	const response = await request();
	const data = await response.json();
	let result = "";

	if(response.status == HttpStatus.OK) {
		result = `Now playing: ${data.item.name} - `;

		const artistsObjects = data.item.artists;

		artistsObjects.forEach((artist, index) => {
			if(index > 0) {
				if(index < artistsObjects.length - 1) {
					result += ", ";
				} else {
					result += " and "
				}
		  	}
			result += artist.name;
		});

	} else if(response.status == HttpStatus.UNAUTHORIZED) {
		throw new UnauthorizedException();
	} else {
		throw httpException(response.status, "Error retrieving song");
	}

	logger.debug("result: " + result);
	return result;
}