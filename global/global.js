import pino from "pino";
import { createSink, logConfig } from "./log-config.js";

const level = process.env.LOG_LEVEL || "info";

// Everything the app logs goes to each of the app log's sinks
const { sinks } = logConfig("app");

const streams = sinks.map((spec, i) => ({
	level: spec.level ?? level,
	stream: createSink(spec, `app.sinks[${i}]`, "app")
}));

// The logger has to pass on the most detailed level any sink asks for
const lowest = streams.reduce((low, { level }) => pino.levels.values[level] < pino.levels.values[low] ? level : low, level);

export const logger = pino({ level: lowest }, pino.multistream(streams));
