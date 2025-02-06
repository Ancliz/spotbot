import RequestBuilder, { BadRequestException, httpException, HttpStatus, UnauthorizedException } from "../global/requests-util.js";


export async function search(token, args) {
    let url = `https://api.spotify.com/v1/search?type=${args[0]}&q=${args[1]}&limit=${args[2]}`;

    const request = new RequestBuilder()
        .url(url)
        .headers({"Authorization": `Bearer ${token}`})
        .build();

    const response = await request();
    const result = await response.json();

    if(response.status === HttpStatus.OK) {
        return result.tracks.items;
    } else if(response.status === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException();
    } else if(response.status === HttpStatus.BAD_REQUEST) {
        throw new BadRequestException(result.error.message);
    } else {
        throw httpException(response.status, result.error.message);
    }

}