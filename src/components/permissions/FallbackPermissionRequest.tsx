import { Box, Text } from "ink";
import type React from "react";
import { useMemo } from "react";
import { Select } from "@inkjs/ui";
import { getTheme } from "../../utils/theme.js";
import {
	PermissionRequestTitle,
	textColorForRiskScore,
} from "./PermissionRequestTitle.js";
import { logUnaryEvent } from "../../utils/unaryLogging.js";
import { env } from "../../utils/env.js";
import { getCwd } from "../../utils/state.js";
import { savePermission } from "../../permissions.js";
import {
	type ToolUseConfirm,
	toolUseConfirmGetPrefix,
} from "./PermissionRequest.js";
import chalk from "chalk";
import {
	type UnaryEvent,
	usePermissionRequestLogging,
} from "../../hooks/usePermissionRequestLogging.js";

type Props = {
	toolUseConfirm: ToolUseConfirm;
	onDone(): void;
	verbose: boolean;
};

export function FallbackPermissionRequest({
	toolUseConfirm,
	onDone,
	verbose,
}: Props): React.ReactNode {
	const theme = getTheme();

	// TODO: Avoid these special cases
	const originalUserFacingName = toolUseConfirm.tool.userFacingName(
		toolUseConfirm.input as never,
	);
	const userFacingName = originalUserFacingName.endsWith(" (MCP)")
		? originalUserFacingName.slice(0, -6)
		: originalUserFacingName;

	const unaryEvent = useMemo<UnaryEvent>(
		() => ({
			completion_type: "tool_use_single",
			language_name: "none",
		}),
		[],
	);

	usePermissionRequestLogging(toolUseConfirm, unaryEvent);

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={textColorForRiskScore(toolUseConfirm.riskScore)}
			marginTop={1}
			paddingLeft={1}
			paddingRight={1}
			paddingBottom={1}
		>
			<PermissionRequestTitle
				title="Tool use"
				riskScore={toolUseConfirm.riskScore}
			/>
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				<Text>
					{userFacingName}(
					{toolUseConfirm.tool.renderToolUseMessage(
						toolUseConfirm.input as never,
						{ verbose },
					)}
					)
					{originalUserFacingName.endsWith(" (MCP)") ? (
						<Text color={theme.secondaryText}> (MCP)</Text>
					) : (
						""
					)}
				</Text>
				<Text color={theme.secondaryText}>{toolUseConfirm.description}</Text>
			</Box>

			<Box flexDirection="column">
				<Text>Do you want to proceed?</Text>
				<Select
					options={[
						{
							label: "Yes",
							value: "yes",
						},
						{
							label: `Yes, and don't ask again for ${chalk.bold(userFacingName)} commands in ${chalk.bold(getCwd())}`,
							value: "yes-dont-ask-again",
						},
						{
							label: `No, and tell Claude what to do differently (${chalk.bold.hex(getTheme().warning)("esc")})`,
							value: "no",
						},
					]}
					onChange={(newValue) => {
						switch (newValue) {
							case "yes":
								logUnaryEvent({
									completion_type: "tool_use_single",
									event: "accept",
									metadata: {
										language_name: "none",
										message_id: toolUseConfirm.assistantMessage.message.id,
										platform: env.platform,
									},
								});
								toolUseConfirm.onAllow("temporary");
								onDone();
								break;
							case "yes-dont-ask-again":
								logUnaryEvent({
									completion_type: "tool_use_single",
									event: "accept",
									metadata: {
										language_name: "none",
										message_id: toolUseConfirm.assistantMessage.message.id,
										platform: env.platform,
									},
								});
								savePermission(
									toolUseConfirm.tool,
									toolUseConfirm.input,
									toolUseConfirmGetPrefix(toolUseConfirm),
								).then(() => {
									toolUseConfirm.onAllow("permanent");
									onDone();
								});
								break;
							case "no":
								logUnaryEvent({
									completion_type: "tool_use_single",
									event: "reject",
									metadata: {
										language_name: "none",
										message_id: toolUseConfirm.assistantMessage.message.id,
										platform: env.platform,
									},
								});
								toolUseConfirm.onReject();
								onDone();
								break;
						}
					}}
				/>
			</Box>
		</Box>
	);
}
