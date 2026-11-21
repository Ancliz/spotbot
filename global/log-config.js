import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pretty from "pino-pretty";
import RollingFile from "./rolling-file.js";

// Relative paths in the config resolve against the project folder, wherever it is installed
export const PROJECT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = process.env.LOG_CONFIG || path.join(PROJECT_DIR, "logging.json");

/**
 * Each log has its own list of sinks. A sink is one of:
 *   { "type": "console", "pretty"?: boolean, "level"?: string }
 *   { "type": "file", "dir"?: string, "name"?: string, "maxMb"?: number, "keep"?: number, "level"?: string }
 * "level" only applies to the app log. A log's sinks in logging.json replace these defaults.
 */
const DEFAULTS = {
	app: {
		sinks: [
			{ type: "console", pretty: true },
			{ type: "file", name: "app", maxMb: 10, keep: 5 }
		]
	},
	requests: {
		enabled: true,
		sinks: [
			{ type: "file", name: "requests", maxMb: 20, keep: 3 }
		]
	}
};

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"];

function fail(where, message) {
	throw new Error(`Invalid log config (${CONFIG_PATH}) at ${where}: ${message}`);
}

function positive(value, fallback, where) {
	if(value === undefined) return fallback;
	if(typeof value !== "number" || !(value > 0)) fail(where, "must be a positive number");
	return value;
}

function readConfig() {
	if(!fs.existsSync(CONFIG_PATH)) {
		if(process.env.LOG_CONFIG) throw new Error("LOG_CONFIG file not found: " + CONFIG_PATH);
		return {};
	}

	try {
		return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
	} catch(err) {
		throw new Error(`Could not read log config ${CONFIG_PATH}: ${err.message}`);
	}
}

const config = readConfig();

/**
 * @param {"app" | "requests"} log
 * @returns {{ enabled: boolean, sinks: object[] }}
 */
export function logConfig(log) {
	const own = config[log] ?? {};
	const sinks = own.sinks ?? DEFAULTS[log].sinks;

	if(!Array.isArray(sinks)) fail(log + ".sinks", "must be an array");

	return { enabled: own.enabled ?? DEFAULTS[log].enabled ?? true, sinks };
}

/**
 * Build a sink with a write(line) method. File sinks also have a path.
 * @param {object} spec a sink from the config
 * @param {string} where its place in the config, for errors
 * @param {string} defaultName the file name when the sink gives none
 */
export function createSink(spec, where, defaultName) {
	if(spec?.level !== undefined && !LEVELS.includes(spec.level)) {
		fail(where + ".level", "must be one of " + LEVELS.join(", "));
	}

	switch(spec?.type) {
		case "console":
			return spec.pretty === false
				? { write: line => process.stdout.write(line) }
				: pretty({ colorize: true, sync: true });

		case "file": {
			const name = spec.name ?? defaultName;
			if(typeof name !== "string" || !/^[\w.-]+$/.test(name)) {
				fail(where + ".name", "must be letters, digits, '.', '_' or '-'");
			}
			if(spec.dir !== undefined && typeof spec.dir !== "string") fail(where + ".dir", "must be a string");

			return new RollingFile({
				dir: path.resolve(PROJECT_DIR, spec.dir ?? process.env.LOG_DIR ?? "logs"),
				name: name,
				maxBytes: positive(spec.maxMb, 10, where + ".maxMb") * 1024 * 1024,
				keep: Math.floor(positive(spec.keep, 5, where + ".keep"))
			});
		}

		default:
			fail(where + ".type", 'must be "console" or "file"');
	}
}
