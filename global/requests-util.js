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


export class HeaderBuilder {

	constructor(base = {}) {
		this.headers = base;
	}

	set(header, value) {
		this.headers[header] = value;
		return this;
	}

	build() {
		return this.headers;
	}
}

export default class RequestBuilder {
    constructor() {
        this.burl = "";
        this.bmethod = "GET";
        this.bheaders = {};
        this.bbody = {};
    }

	getHeaderBuilder() {
		return new HeaderBuilder(this.bheaders);
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

export class BadRequestException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class UnauthorizedException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class ForbiddenException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotFoundException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class MethodNotAllowedException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotAcceptableException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class ConflictException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class IAmATeapotException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class InternalServerErrorException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotImplementedException extends Error {
	constructor(message) {
		super(message);
		this.name = this.constructor.name;
	}
}

export function httpException(statusCode, message = "") {
	switch (statusCode) {
		case HttpStatus.BAD_REQUEST:            return new BadRequestException(message || "Bad Request");
		case HttpStatus.UNAUTHORIZED:           return new UnauthorizedException(message || "Unauthorized");
		case HttpStatus.FORBIDDEN:              return new ForbiddenException(message || "Forbidden");
	    case HttpStatus.NOT_FOUND:              return new NotFoundException(message || "Not Found");
		case HttpStatus.METHOD_NOT_ALLOWED:     return new MethodNotAllowedException(message || "Method Not Allowed");
		case HttpStatus.NOT_ACCEPTABLE:         return new NotAcceptableException(message || "Not Acceptable");
		case HttpStatus.CONFLICT:               return new ConflictException(message || "Conflict");
		case HttpStatus.I_AM_A_TEAPOT:          return new IAmATeapotException(message || "I'm a teapot");
		case HttpStatus.INTERNAL_SERVER_ERROR:  return new InternalServerErrorException(message || "Internal Server Error");
		case HttpStatus.NOT_IMPLEMENTED:        return new NotImplementedException(message || "Not Implemented");
		default:                                return new Error("Error: " + statusCode);
	}
}