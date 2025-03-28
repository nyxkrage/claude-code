import { Box, Text } from "ink";
import React from "react";
import { z } from "zod";
import { Cost } from "../../components/Cost.js";
import { FallbackToolUseRejectedMessage } from "../../components/FallbackToolUseRejectedMessage.js";
import type { Tool } from "../../Tool.js";
import { getCwd } from "../../utils/state.js";
import { glob } from "../../utils/file.js";
import { DESCRIPTION, TOOL_NAME_FOR_PROMPT } from "./prompt.js";
import { isAbsolute, relative, resolve } from "node:path";
import { hasReadPermission } from "../../utils/permissions/filesystem.js";

const inputSchema = z.strictObject({
	pattern: z.string().describe("The glob pattern to match files against"),
	path: z
		.string()
		.optional()
		.describe(
			"The directory to search in. Defaults to the current working directory.",
		),
});

type Output = {
	durationMs: number;
	numFiles: number;
	filenames: string[];
	truncated: boolean;
};

export const GlobTool = {
	name: TOOL_NAME_FOR_PROMPT,
	async description() {
		return DESCRIPTION;
	},
	userFacingName() {
		return "Search";
	},
	inputSchema,
	async isEnabled() {
		return true;
	},
	isReadOnly() {
		return true;
	},
	needsPermissions({ path }) {
		return !hasReadPermission(path || getCwd());
	},
	async prompt() {
		return DESCRIPTION;
	},
	renderToolUseMessage({ pattern, path }, { verbose }) {
		const absolutePath = path
			? isAbsolute(path)
				? path
				: resolve(getCwd(), path)
			: undefined;
		const relativePath = absolutePath
			? relative(getCwd(), absolutePath)
			: undefined;
		return `pattern: "${pattern}"${relativePath || verbose ? `, path: "${verbose ? absolutePath : relativePath}"` : ""}`;
	},
	renderToolUseRejectedMessage() {
		return <FallbackToolUseRejectedMessage />;
	},
	renderToolResultMessage(output) {
		// Handle string content for backward compatibility
		if (typeof output === "string") {
			// biome-ignore lint/style/noParameterAssign: introducing a new local variable makes this code less readable as this just handles overloaded functions and ensures the rest of the function can assume the type is correct
			output = JSON.parse(output) as Output;
		}

		return (
			<Box justifyContent="space-between" width="100%">
				<Box flexDirection="row">
					<Text>&nbsp;&nbsp;⎿ &nbsp;Found </Text>
					<Text bold>{output.numFiles} </Text>
					<Text>
						{output.numFiles === 0 || output.numFiles > 1 ? "files" : "file"}
					</Text>
				</Box>
				<Cost costUSD={0} durationMs={output.durationMs} debug={false} />
			</Box>
		);
	},
	async *call({ pattern, path }, { abortController }) {
		const start = Date.now();
		const { files, truncated } = await glob(
			pattern,
			path ?? getCwd(),
			{ limit: 100, offset: 0 },
			abortController.signal,
		);
		const output: Output = {
			filenames: files,
			durationMs: Date.now() - start,
			numFiles: files.length,
			truncated,
		};
		yield {
			type: "result",
			resultForAssistant: this.renderResultForAssistant(output),
			data: output,
		};
	},
	renderResultForAssistant(output) {
		let result = output.filenames.join("\n");
		if (output.filenames.length === 0) {
			result = "No files found";
		}
		// Only add truncation message if results were actually truncated
		else if (output.truncated) {
			result +=
				"\n(Results are truncated. Consider using a more specific path or pattern.)";
		}
		return result;
	},
} satisfies Tool<typeof inputSchema, Output>;
