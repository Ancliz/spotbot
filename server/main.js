import start from "./http-server.js";
import * as CallbackUtil from "../global/token-callbacks.js";
import { PROJECT_DIR } from "../global/log-config.js";
import { logger } from "../global/global.js";
import fs from "fs";
import path from "path";

// Tokens live in TOKEN_DIR (a volume in Docker), or data/ in the project
const TOKEN_DIR = path.resolve(PROJECT_DIR, process.env.TOKEN_DIR || "data");
const ACCESS_TOKEN = path.join(TOKEN_DIR, "access_token");
const REFRESH_TOKEN = path.join(TOKEN_DIR, "refresh_token");

fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });

// Token files are owner read/write only. mode applies on creation; chmod fixes existing files
function save(file, token) {
	try {
		fs.writeFileSync(file, token, { mode: 0o600 });
		fs.chmodSync(file, 0o600);
	} catch(err) {
		logger.error("Could not save " + file + ": " + err.message);
	}
}

// The saved token, or "" when there is none so the first request refreshes or asks for a login
function load(file) {
	try {
		return fs.readFileSync(file, "utf8").trim();
	} catch {
		return "";
	}
}

function required(name) {
	if(!process.env[name]) {
		logger.fatal(name + " must be set.");
		process.exit(1);
	}
	return process.env[name];
}

CallbackUtil.registerCallbacks(
	token => save(ACCESS_TOKEN, token),
	token => save(REFRESH_TOKEN, token),
	() => load(ACCESS_TOKEN),
	() => load(REFRESH_TOKEN)
);

start(
	required("CLIENT_ID"),
	required("REDIRECT_URI"),
	required("ALLOWED_USER_ID"),
	process.env.LISTEN_HOST,
	process.env.API_KEY,
	process.env.TRUSTED_NETWORKS
);

// As PID 1 in a container Node gets no default signal handling, so stop promptly ourselves
for(const signal of ["SIGTERM", "SIGINT"]) {
	process.on(signal, () => {
		logger.info("Received " + signal + ", stopping");
		process.exit(0);
	});
}