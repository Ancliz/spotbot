import fs from "fs";
import path from "path";

/**
 * An append-only file that rolls over once it is full. <name>.jsonl is the current file and
 * <name>.1.jsonl the newest old one; only `keep` old files are kept, so disk use is bounded by
 * maxBytes * (keep + 1). Opening one always starts a fresh file.
 *
 * Errors go to the console, since this also backs the logger.
 */
export default class RollingFile {
	/**
	 * @param {{ dir: string, name: string, maxBytes: number, keep: number }} options
	 */
	constructor({ dir, name, maxBytes, keep }) {
		this.dir = dir;
		this.name = name;
		this.maxBytes = maxBytes;
		this.keep = keep;
		this.size = 0;
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		this.rotate();
	}

	get path() {
		return this.pathOf(0);
	}

	pathOf(index) {
		return path.join(this.dir, index === 0 ? this.name + ".jsonl" : `${this.name}.${index}.jsonl`);
	}

	// Shift every file up one place, delete those past `keep` and start an empty current file
	rotate() {
		const escaped = this.name.replace(/[.]/g, "\\.");
		const old = new RegExp(`^${escaped}\\.(\\d+)\\.jsonl$`);

		for(const file of fs.readdirSync(this.dir)) {
			const match = old.exec(file);
			if(match && Number(match[1]) >= this.keep) fs.rmSync(path.join(this.dir, file), { force: true });
		}

		for(let i = this.keep - 1; i >= 0; --i) {
			if(fs.existsSync(this.pathOf(i))) fs.renameSync(this.pathOf(i), this.pathOf(i + 1));
		}

		fs.writeFileSync(this.path, "", { mode: 0o600 });
		this.size = 0;
	}

	// Append a line, starting a new file first when it would not fit
	write(line) {
		try {
			const bytes = Buffer.byteLength(line);
			if(this.size > 0 && this.size + bytes > this.maxBytes) this.rotate();
			fs.appendFileSync(this.path, line);
			this.size += bytes;
		} catch(err) {
			console.error("Failed to write " + this.path + ": " + err.message);
		}
	}
}
