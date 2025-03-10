import fs from "node:fs/promises";
import { logError } from "./log.js";
import type { Tool } from "../Tool.ts";


export async function loadMessagesFromLog(
	logPath: string,
	tools: Tool[],
// biome-ignore lint/suspicious/noExplicitAny: unsure what format the saved messages are in so we use any to not break downstream code that might not do any validation
): Promise<any[]> {
	try {
		const content = await fs.readFile(logPath, "utf-8");
		const messages = JSON.parse(content);
		return deserializeMessages(messages, tools);
	} catch (error) {
		logError(`Failed to load messages from ${logPath}: ${error}`);
		throw new Error(`Failed to load messages from log: ${error}`);
	}
}

// biome-ignore lint/suspicious/noExplicitAny: unsure what format the saved messages are in so we use any to not break downstream code that might not do any validation
export  function deserializeMessages(messages: any[], tools: Tool[]): any[] {
	// Map of tool names to actual tool instances for reconnection
	const toolMap = new Map(tools.map((tool) => [tool.name, tool]));

	return messages.map((message) => {
		// Deep clone the message to avoid mutation issues
		const clonedMessage = JSON.parse(JSON.stringify(message));

		// If the message has tool calls, reconnect them to actual tool instances
		if (clonedMessage.toolCalls) {
			// biome-ignore lint/suspicious/noExplicitAny: unsure what format the saved messages are in so we use any to not break downstream code that might not do any validation
			clonedMessage.toolCalls = clonedMessage.toolCalls.map((toolCall: any) => {
				// Reconnect tool reference if it exists
				if (toolCall.tool && typeof toolCall.tool === "string") {
					const actualTool = toolMap.get(toolCall.tool);
					if (actualTool) {
						toolCall.tool = actualTool;
					}
				}
				return toolCall;
			});
		}

		return clonedMessage;
	});
}
