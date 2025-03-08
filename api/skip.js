import RequestBuilder, { HttpStatus } from "../global/requests-util.js";

export default async function next(token) {
    const request = new RequestBuilder()
        .url("https://api.spotify.com/v1/me/player/next")
        .headers({ "Authorization": `Bearer ${token}` })
        .method("POST")
        .build();

    const response = await request();
    
    if(response.status === HttpStatus.OK) {
        return true;
    } else {
        throw httpException(response.status, response.error.message);
    }

}