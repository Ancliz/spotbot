import fs from "fs"

export default function write(path, data) {
	fs.writeFile(path, data, err => {
		if(err) {
			console.error(`Error writing to ${path}:`, err);
		}
	})
}