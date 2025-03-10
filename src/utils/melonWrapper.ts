import { spawn } from "child_process";
import { logError } from "./log.js";

/**
 * Run a command in melon mode
 * Special mode for ant users that passes args to a melon command
 *
 * @param args Arguments to pass to the melon command
 * @returns Exit code from the melon process
 */
export function runMelonWrapper(args: string[]): number {
	try {
		console.log("Running in melon mode with args:", args);

		// Create a synchronous child process to run the melon command
		const result = spawn("melon", args, {
			stdio: "inherit",
			shell: true,
		});

		// Return exit code or 0 if undefined
		if (typeof result.exitCode === "number") {
			return result.exitCode;
		}

		// If we can't get the exit code, assume success
		return 0;
	} catch (error) {
		logError(`Error running melon command: ${error}`);
		console.error("Failed to run melon command:", error);
		return 1;
	}
}
