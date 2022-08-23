/**
 * @module lib/file_ops
 */
"use strict";
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto"); // needed for getTempFile
/**
 * Returns the newest file in a directory
 *
 * @param {string} directory - The directory to look for the newest file in.
 * @param {function(string): boolean} filter -
 *     Optional function to filter out files to ignore.  Should return true
 *     if the file is to be considered.
 * @returns {?string}
 *     Name of the file with the newest timestamp or null if the
 *     directory contains no files.
 */
async function getNewestFile(directory, filter = (name) => true) {
	let newestTime = new Date(0);
	let newestFile = null;
	for (let entry of await fs.readdir(directory, { withFileTypes: true })) {
		if (entry.isFile()) {
			let stat = await fs.stat(path.join(directory, entry.name));
			if (filter(entry.name) && stat.mtime > newestTime) {
				newestTime = stat.mtime;
				newestFile = entry.name;
			}
		}
	}

	return newestFile;
}

/**
 * Modifies name in case it already exisist at the given directory
 *
 * Checks the directory passed if it already contains a file or folder with
 * the given name, if it does not returns name unmodified, otherwise it
 * returns a modified name that does not exist in the directory.
 *
 * Warning: this function should not be relied upon to be accurate for
 * security sensitive applications.  The selection process is inherently
 * racy and a file or folder may have been created in the folder by the time
 * this function returns.
 *
 * @param {string} directory - directory to check in.
 * @param {string} name - file name to check for, may have extension.
 * @param {string} extension - dot extension used for the file name.
 * @returns {string} modified name with extension that likely does not exist
 *     in the folder
 */
async function findUnusedName(directory, name, extension = "") {
	if (extension && name.endsWith(extension)) {
		name = name.slice(0, -extension.length);
	}

	while (true) {
		if (!await fs.pathExists(path.join(directory, `${name}${extension}`))) {
			return `${name}${extension}`;
		}

		let match = /^(.*?)(-(\d+))?$/.exec(name);
		if (!match[2]) {
			name = `${match[1]}-2`;
		} else {
			name = `${match[1]}-${Number.parseInt(match[3], 10) + 1}`;
		}
	}
}
/**
 * Warning: this function should not be relied upon to be accurate for
 * security sensitive applications.  The selection process is inherently
 * racy and a file or folder may have been created in the folder by the time
 * this function returns.
 *
 * @param {string} prefix - Prefix for file
 * @param {string} suffix - Suffix for file
 * @param {string} tmpdir - Directory for temp file
 */
async function getTempFile(prefix, suffix, tmpdir) {
	prefix = (typeof prefix !== "undefined") ? prefix : "tmp.";
	suffix = (typeof suffix !== "undefined") ? suffix : "";
	tmpdir = (typeof tmpdir !== "undefined") ? tmpdir : "./";
	let fileName = path.join(prefix + crypto.randomBytes(16).toString("hex") + suffix);
	let freeFile = await findUnusedName(tmpdir, fileName);
	let fullPath = path.join(tmpdir, freeFile);
	return fullPath;
}
/**
 * Safely write data to a file
 *
 * Same as fs-extra.outputFile except the data is written to a temporary
 * file that's renamed over the target file.  The name of the temporary file
 * is the same as the target file with the suffix `.tmp` added.
 *
 * If the operation fails it may leave behind the temporary file.  This
 * should not be too much of an issue as the next time the same file is
 * written the temporary will be overwritten and renamed to the target file.
 *
 * @param {string} file - Path to file to write.
 * @param {string|Buffer} data - Content to write.
 * @param {object|string} options - see fs.writeFile, `flag` must not be set.
 */
async function safeOutputFile(file, data, options={}) {
	let temporary = `${file}.tmp`;
	await fs.outputFile(temporary, data, options);
	await fs.rename(temporary, file);
}

/**
 * Check if a string is a valid file name
 *
 * @param {string} name - Name to check
 * @throws Error if the name is unsuitable.
 */
function checkFilename(name) {
	// All of these are bad in Windows only, except for /, . and ..
	// See: https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file
	const badChars = /[<>:"\/\\|?*\x00-\x1f]/g;
	const badEnd = /[. ]$/;

	const oneToNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	const badNames = [
		// Relative path components
		".", "..",

		// Reserved filenames in Windows
		"CON", "PRN", "AUX", "NUL",
		...oneToNine.map(n => `COM${n}`),
		...oneToNine.map(n => `LPT${n}`),
	];

	if (typeof name !== "string") {
		throw new Error("must be a string");
	}

	if (name === "") {
		throw new Error("cannot be empty");
	}

	if (badChars.test(name)) {
		throw new Error('cannot contain <>:"\\/|=* or control characters');
	}

	if (badNames.includes(name.toUpperCase())) {
		throw new Error(
			"cannot be named any of . .. CON PRN AUX NUL COM1-9 and LPT1-9"
		);
	}

	if (badEnd.test(name)) {
		throw new Error("cannot end with . or space");
	}
}

/**
 * Clean up string to be suitable for use as filename
 *
 * @param {string} name - Arbitrary name string
 * @returns {string} Filename suitable to use in the filesystem
 */
function cleanFilename(name) {
	// copied from checkFilename
	const badChars = /[<>:"\/\\|?*\x00-\x1f]/g;
	const badEnd = /[. ]$/;

	const oneToNine = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	const badNames = [
		// Relative path components
		".", "..",

		// Reserved filenames in Windows
		"CON", "PRN", "AUX", "NUL",
		...oneToNine.map(n => `COM${n}`),
		...oneToNine.map(n => `LPT${n}`),
	];

	if (typeof name !== "string") {
		throw new Error("name must be a string");
	}

	if (name === "" || badNames.includes(name.toUpperCase())) {
		name += "_";
	}

	name = name.replace(badChars, "_");
	name = name.replace(badEnd, "_");

	return name;
}


module.exports = {
	getNewestFile,
	findUnusedName,
	getTempFile,
	safeOutputFile,
	checkFilename,
	cleanFilename,
};
