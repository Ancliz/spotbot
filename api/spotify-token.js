import RequestBuilder, { HttpStatus } from "../global/requests-util.js";
import querystring from "querystring";
import { logger } from "../global/global.js"
import * as CallbackUtil from "../global/token-callbacks.js"

/**
 * @param {string} clientId 
 * @param {string} clientSecret 
 * @param {string} refreshToken 
 * @returns Once resolved, the JSON object of the response body.
 * Children include `access_token` and, if present, a new `refresh_token`
 */
export default async function refreshSpotifyToken(clientId, refreshToken) {
    const request = new RequestBuilder()
        .url("https://accounts.spotify.com/api/token")
        .method("POST")
        .headers({ "Content-Type": "application/x-www-form-urlencoded" })
        .body(querystring.stringify({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId
        }))
        .build();
       
    const response = await request();

    if(response.status === HttpStatus.OK) {
        const data = await response.json();
        logger.debug("data: " + JSON.stringify(data));
        logger.info("Refresh Request OK");
        CallbackUtil.saveAccessToken(data.access_token);
        
        if(data.refresh_token) {
            CallbackUtil.saveRefreshToken(data.refresh_token);
        }
        
        return data;
    } else {
        logger.debug(refreshToken);
        logger.error(response.status + ": " + await response.text());
    }
}