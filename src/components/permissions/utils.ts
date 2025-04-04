import { env } from "../../utils/env.js";
import { type CompletionType, logUnaryEvent } from "../../utils/unaryLogging.js";
import type { ToolUseConfirm } from "./PermissionRequest.js";

export function logUnaryPermissionEvent(
	completion_type: CompletionType,
	{
		assistantMessage: {
			message: { id: message_id },
		},
	}: ToolUseConfirm,
	event: "accept" | "reject",
): void {
	logUnaryEvent({
		completion_type,
		event,
		metadata: {
			language_name: "none",
			message_id,
			platform: env.platform,
		},
	});
}
