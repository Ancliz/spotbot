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

export async function timeUntil(token, uri) {
    const queue = (await getQueue(token)).queue;

    const playerStateRequest = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player")
        .headers({"Authorization": `Bearer ${token}`})
        .build();
        
    const response = await playerStateRequest();
    const state = await response.json();

    let timeLeft = state.item.duration_ms - state.progress_ms;

    for(let i = 0; i < queue.length; ++i) {
        if(queue[i].uri === uri) {
            break;
        }

        timeLeft += queue[i].duration_ms;
    }

    return timeLeft;
}