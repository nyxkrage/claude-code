import { mkdirSync, writeFileSync } from "node:fs";
import { Box, Text } from "ink";
import { dirname, join } from "node:path";
import * as React from "react";
import { z } from "zod";
import { FallbackToolUseRejectedMessage } from "../../components/FallbackToolUseRejectedMessage.js";
import type { Tool } from "../../Tool.js";
import { MEMORY_DIR } from "../../utils/env.js";
import { DESCRIPTION, PROMPT } from "./prompt.js";

const inputSchema = z.strictObject({
	file_path: z.string().describe("Path to the memory file to write"),
	content: z.string().describe("Content to write to the file"),
});

export const MemoryWriteTool = {
	name: "MemoryWrite",
	async description() {
		return DESCRIPTION;
	},
	async prompt() {
		return PROMPT;
	},
	inputSchema,
	userFacingName() {
		return "Write Memory";
	},
	async isEnabled() {
		// TODO: Use a statsig gate
		// TODO: Figure out how to do that without regressing app startup perf
		return false;
	},
	isReadOnly() {
		return false;
	},
	needsPermissions() {
		return false;
	},
	renderResultForAssistant(content) {
		return content;
	},
	renderToolUseMessage(input) {
		return Object.entries(input)
			.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
			.join(", ");
	},
	renderToolUseRejectedMessage() {
		return <FallbackToolUseRejectedMessage />;
	},
	renderToolResultMessage() {
		return (
			<Box justifyContent="space-between" overflowX="hidden" width="100%">
				<Box flexDirection="row">
					<Text>{"  "}⎿ Updated memory</Text>
				</Box>
			</Box>
		);
	},
	async validateInput({ file_path }) {
		const fullPath = join(MEMORY_DIR, file_path);
		if (!fullPath.startsWith(MEMORY_DIR)) {
			return { result: false, message: "Invalid memory file path" };
		}
		return { result: true };
	},
	async *call({ file_path, content }) {
		const fullPath = join(MEMORY_DIR, file_path);
		mkdirSync(dirname(fullPath), { recursive: true });
		writeFileSync(fullPath, content, "utf-8");
		yield {
			type: "result",
			data: "Saved",
			resultForAssistant: "Saved",
		};
	},
} satisfies Tool<typeof inputSchema, string>;
