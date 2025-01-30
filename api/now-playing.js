import RequestBuilder, { HttpStatus } from "../global/requests-util.js"
import refreshSpotifyToken from "./spotify-token.js"

import { logger } from "../global/global.js";

export default async function nowPlaying(client_id, client_secret, token, refresh_token, attempt = 0) {
	if(attempt > 1) {
		logger.error("Maximum attempts exceeded.");
		return;
	}

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
		result = "401: Error retrieving song.";
		logger.error(result);
		const data = await refreshSpotifyToken(client_id, client_secret, refresh_token);
		token = data.access_token;
		result = await nowPlaying(client_id, client_secret, token, refresh_token, attempt++);
	} else {
		result = "Error retrieving song: " + response.status;
		logger.error(result);
	}

	logger.debug("[attempt: " + attempt + "] result: " + result);
	return result;
}