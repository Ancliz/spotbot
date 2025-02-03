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
	let result = "";

	if(response.status == HttpStatus.OK) {
	 	const data = await response.json();
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

	} else if(response.status === HttpStatus.NO_CONTENT) {
		result = "Player not currently active"
	} else if(response.status == HttpStatus.UNAUTHORIZED) {
		throw new UnauthorizedException("Failed to get currently playing song");
	} else {
		throw httpException(response.status, "Error retrieving song");
	}

	logger.debug("result: " + result);
	return result;
}