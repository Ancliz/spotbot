export const HttpStatus = Object.freeze({
    OK: 200,
    CREATED: 201,
    ACCEPTED: 202,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    NOT_ACCEPTABLE: 406,
    CONFLICT: 409,
    I_AM_A_TEAPOT: 418,
    INTERNAL_SERVER_ERROR: 500,
    NOT_IMPLEMENTED: 501,
});

export default class RequestBuilder {
    constructor() {
        this.burl = '';
        this.bmethod = 'GET';
        this.bheaders = {};
        this.bbody = {};
    }

    url(url) {
        this.burl = url;
        return this;
    }

    method(method) {
        this.bmethod = method;
        return this;
    }

    headers(headers) {
        this.bheaders = headers;
        return this;
    }

    body(body) {
        this.bbody = body;
        return this;
    }

    build() {
        return () => {
            const options = {
                method: this.bmethod,
                headers: this.bheaders
            };

            if(this.bmethod !== "GET" && Object.keys(this.bbody).length > 0) {
                if(typeof this.bbody === "string") {
                    options.body = this.bbody;
                } else {
                    options.body = JSON.stringify(this.bbody);
                }
            }
            return fetch(this.burl, options);     
        };
    }
}