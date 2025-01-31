import RequestBuilder from "../global/requests-util.js"
import { logger } from "../global/global.js";
import { doAuthenticatedQuery } from "./do-query.js";

/**
 * @param {string} token 
 * @returns {string} the formatted title and artists of the song currently playing
 */
export default async function nowPlayingDoQuery(client_id, client_secret, token, refresh_token) {
	const request = new RequestBuilder()
		.url("https://api.spotify.com/v1/me/player/currently-playing")
		.headers( { "Authorization": `Bearer ${token}` } )

	let data = ""
	let result = ""
	try {
		data = await (await doAuthenticatedQuery(request, token, refresh_token, client_id, client_secret)).json();
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
	} catch(error) {
		logger.error("Error retrieving song: " + error.message);
	}

	logger.debug("doQuery result: " + result);
	return result;
}