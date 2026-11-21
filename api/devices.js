import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js"
import { getPlaybackState, play as resume } from "./playback.js";
import { logger } from "../global/global.js";

/**
 * @param {string} token
 * @returns {Promise<object[]>} the user's Spotify Connect devices
 */
export default async function getDevices(token) {
    const request = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player/devices")
        .headers({ "Authorization": `Bearer ${token}` })
        .build();

    const response = await request();

    if(response.status === HttpStatus.OK) {
        return (await response.json()).devices;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException(await response.text());
    } else {
        throw httpException(response.status, await response.text());
    }
}

/**
 * Move playback to a Spotify Connect device. When that device is already the active one, playback
 * is not moved, since Spotify would restart it there with a brief silence; it is only resumed when
 * asked to play and paused.
 * @param {string} token
 * @param {[string, boolean]} args the device id, and whether to start playing there
 * @returns {Promise<boolean>} true once Spotify accepts the cast, or when there is nothing to do
 */
export async function castPlayback(token, [deviceId, play]) {
    const state = await getPlaybackState(token);

    if(state && state.device?.id === deviceId) {
        if(play && !state.is_playing) {
            return await resume(token, [deviceId]);
        }
        logger.debug("Already playing on " + (state.device.name ?? deviceId) + ", not casting");
        return true;
    }

    const request = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player")
        .method("PUT")
        .headers({ "Authorization": `Bearer ${token}`, "Content-Type": "application/json" })
        .body({ device_ids: [deviceId], play: play })
        .build();

    const response = await request();

    if(response.status === HttpStatus.OK || response.status === HttpStatus.ACCEPTED || response.status === HttpStatus.NO_CONTENT) {
        return true;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException(await response.text());
    } else {
        throw httpException(response.status, await response.text());
    }
}