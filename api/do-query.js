import { BadRequestException, UnauthorizedException } from "../global/requests-util.js";
import refreshSpotifyToken from "./spotify-token.js";
import { logger } from "../global/global.js"

/**
 * A general function to run functions that make authenticated API calls
 * to handle refreshing the token when expired
 * @param {function} runnable 
 * @param {string} access_token 
 * @param {string} refresh_token 
 * @param {string} client_id 
 * @param {string} client_secret 
 * @returns the result of running the function
 */
export async function runAuthenticated(runnable, access_token, refresh_token, client_id, client_secret, args) {
    let result = null;

    if(access_token === "") {
        access_token = (await refreshSpotifyToken(client_id, client_secret, refresh_token)).access_token;
    }

    try {
        result = await runnable(access_token, args);
    } catch(error) {
        if(error instanceof UnauthorizedException || error instanceof BadRequestException) {
            logger.error(error.message);
            access_token = (await refreshSpotifyToken(client_id, client_secret, refresh_token)).access_token;
            result = await runnable(access_token, args);
        }
    }

    return result;
}