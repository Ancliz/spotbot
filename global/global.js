import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL,
	transport: {
		target: "pino-pretty",
		options: { colorize: true }
	}
});