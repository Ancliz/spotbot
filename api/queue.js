// 

import RequestBuilder, { httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js"

export default async function getQueue(token) {

    const request = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player/queue")
        .headers({ "Authorization": `Bearer ${token}`})
        .build();

    const response = await request();

    if(response.status === HttpStatus.OK) {
        return await response.json();
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        const error = await response.text();
        throw new UnauthorizedException(error);
    } else {
        throw httpException(response.status, await response.text());
    }
}

/**
 * @param {string} token
 * @param {string} uri a spotify:track: uri
 * @returns {Promise<number | false>} ms until the track plays, or false when nothing is playing
 * or the track is not queued
 */
export async function timeUntil(token, uri) {
    const queue = (await getQueue(token)).queue;

    const playerStateRequest = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player")
        .headers({"Authorization": `Bearer ${token}`})
        .build();
        
    const response = await playerStateRequest();

    // 204 with no body means no active player
    if(response.status === HttpStatus.NO_CONTENT) {
        return false;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException(await response.text());
    } else if(response.status !== HttpStatus.OK) {
        throw httpException(response.status, await response.text());
    }

    const state = await response.json();

    if(!state.item) {
        return false;
    }

    let timeLeft = state.item.duration_ms - state.progress_ms;

    for(let i = 0; i < queue.length; ++i) {
        if(queue[i].uri === uri) {
            return timeLeft;
        }

        timeLeft += queue[i].duration_ms;
    }

    return false;
}

function normalise(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Whether a spoken description, such as "bohemian rhapsody by queen", names the track.
 */
function names(track, song) {
    const title = normalise(track?.name ?? "");
    const spoken = normalise(song);
    const full = normalise(`${track?.name ?? ""} by ${track?.artists?.[0]?.name ?? ""}`);
    return title !== "" && (spoken.includes(title) || full.includes(spoken));
}

/**
 * @param {string} token
 * @param {string} song a spoken description of a track
 * @returns {Promise<{track: object, ms: number} | false>} the matching track and ms until it plays
 * (0 when it is playing now), or false when it is not playing or queued
 */
export async function timeUntilSong(token, song) {
    const { currently_playing, queue } = await getQueue(token);

    if(names(currently_playing, song)) {
        return { track: currently_playing, ms: 0 };
    }

    const track = queue.find(item => names(item, song));

    if(!track) {
        return false;
    }

    const ms = await timeUntil(token, track.uri);
    return ms === false ? false : { track, ms };
}