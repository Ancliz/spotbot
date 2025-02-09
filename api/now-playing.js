import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js"

/**
 * @param {string} token 
 * @returns {object | string} the track object, or a message that the player is not active.
 */
export default async function nowPlaying(token) {
	const request = new RequestBuilder()
		.url("https://api.spotify.com/v1/me/player/currently-playing")
		.headers( { "Authorization": `Bearer ${token}` } )
		.build();
		
	const response = await request();
	
	if(response.status === HttpStatus.OK) {
	 	return (await response.json()).item;
	} else if(response.status === HttpStatus.NO_CONTENT) {
		return "Player not currently active";
	} else if(response.status === HttpStatus.UNAUTHORIZED) {
		throw new UnauthorizedException("Failed to get currently playing song");
	} else {
		throw httpException(response.status, "Error retrieving song");
	}

}