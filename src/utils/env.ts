import { execFileNoThrow } from "./execFileNoThrow.js";
import { memoize } from "lodash-es";
import { join } from "node:path";
import { homedir } from "node:os";

// Base directory for all Claude Code data files (except config.json for backwards compatibility)
export const CLAUDE_BASE_DIR =
	process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");

// Config and data paths
export const GLOBAL_CLAUDE_FILE = process.env.CLAUDE_CONFIG_DIR
	? join(CLAUDE_BASE_DIR, "config.json")
	: join(homedir(), ".claude.json");
export const MEMORY_DIR = join(CLAUDE_BASE_DIR, "memory");

const getIsDocker = memoize(async (): Promise<boolean> => {
	// Check for .dockerenv file
	const { code } = await execFileNoThrow("test", ["-f", "/.dockerenv"]);
	if (code !== 0) {
		return false;
	}
	return process.platform === "linux";
});

const hasInternetAccess = memoize(async (): Promise<boolean> => {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 1000);

		await fetch("http://1.1.1.1", {
			method: "HEAD",
			signal: controller.signal,
		});

		clearTimeout(timeout);
		return true;
	} catch {
		return false;
	}
});

// all of these should be immutable
export const env = {
	getIsDocker,
	hasInternetAccess,
	isCI: Boolean(process.env.CI),
	platform:
		process.platform === "win32"
			? "windows"
			: process.platform === "darwin"
				? "macos"
				: "linux",
	nodeVersion: process.version,
	terminal: process.env.TERM_PROGRAM,
};
