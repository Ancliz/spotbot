import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL || 'info',
	transport: {
		target: "pino-pretty",
		options: { 
			colorize: false,
			destination: "logs/spotbot.log" 
		}
	}
});

export const serverLogger = pino({
	level: process.env.LOG_LEVEL || 'trace',
	transport: {
		target: "pino-pretty",
		options: { 
			colorize: false,
			// destination: "logs/spotbot.log" 
		}
	}
});