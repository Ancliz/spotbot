import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js"

const PLAYER = "https://api.spotify.com/v1/me/player";

// Send a player command. Spotify answers 200, 202 or 204 on success
async function command(token, method, path, query = {}, body = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined));
    const qs = params.size > 0 ? "?" + params : "";

    const request = new RequestBuilder()
        .url(PLAYER + path + qs)
        .method(method)
        .headers({ "Authorization": `Bearer ${token}`, "Content-Type": "application/json" })
        .body(body)
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

/**
 * @param {string} token
 * @returns {Promise<object | false>} the playback state, or false when nothing is playing
 */
export async function getPlaybackState(token) {
    const request = new RequestBuilder()
        .url(PLAYER)
        .headers({ "Authorization": `Bearer ${token}` })
        .build();

    const response = await request();

    if(response.status === HttpStatus.OK) {
        return await response.json();
    } else if(response.status === HttpStatus.NO_CONTENT) {
        return false;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException(await response.text());
    } else {
        throw httpException(response.status, await response.text());
    }
}

/**
 * Resume playback, or play a track or context (album, playlist, artist).
 * @param {[string?, string?]} args an optional device id and spotify uri
 */
export function play(token, [deviceId, uri] = []) {
    let body = {};
    if(uri?.startsWith("spotify:track:")) body = { uris: [uri] };
    else if(uri) body = { context_uri: uri };
    return command(token, "PUT", "/play", { device_id: deviceId }, body);
}

export function pause(token) {
    return command(token, "PUT", "/pause");
}

export function next(token) {
    return command(token, "POST", "/next");
}

export function previous(token) {
    return command(token, "POST", "/previous");
}

/** @param {number} positionMs */
export function seek(token, positionMs) {
    return command(token, "PUT", "/seek", { position_ms: positionMs });
}

/** @param {number} percent 0 to 100 */
export function setVolume(token, percent) {
    return command(token, "PUT", "/volume", { volume_percent: percent });
}

/** @param {boolean} state */
export function setShuffle(token, state) {
    return command(token, "PUT", "/shuffle", { state: state });
}

/** @param {"track" | "context" | "off"} state */
export function setRepeat(token, state) {
    return command(token, "PUT", "/repeat", { state: state });
}
