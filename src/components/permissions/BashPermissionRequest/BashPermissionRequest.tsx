import { Box, Text } from "ink";
import type React from "react";
import { useMemo } from "react";
import type { UnaryEvent } from "../../../hooks/usePermissionRequestLogging.js";
import { savePermission } from "../../../permissions.js";
import { BashTool } from "../../../tools/BashTool/BashTool.js";
import { getTheme } from "../../../utils/theme.js";
import { usePermissionRequestLogging } from "../hooks.js";
import {
	type ToolUseConfirm,
	toolUseConfirmGetPrefix,
} from "../PermissionRequest.js";
import { PermissionRequestTitle } from "../PermissionRequestTitle.js";
import { logUnaryPermissionEvent } from "../utils.js";
import { Select } from "../../CustomSelect/index.js";
import { toolUseOptions } from "../toolUseOptions.js";

type Props = {
	toolUseConfirm: ToolUseConfirm;
	onDone(): void;
};

export function BashPermissionRequest({
	toolUseConfirm,
	onDone,
}: Props): React.ReactNode {
	const theme = getTheme();

	// ok to use parse since we've already validated args earliers
	const { command } = BashTool.inputSchema.parse(toolUseConfirm.input);

	const unaryEvent = useMemo<UnaryEvent>(
		() => ({ completion_type: "tool_use_single", language_name: "none" }),
		[],
	);

	usePermissionRequestLogging(toolUseConfirm, unaryEvent);

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={theme.permission}
			marginTop={1}
			paddingLeft={1}
			paddingRight={1}
			paddingBottom={1}
		>
			<PermissionRequestTitle
				title="Bash command"
				riskScore={toolUseConfirm.riskScore}
			/>
			<Box flexDirection="column" paddingX={2} paddingY={1}>
				<Text>{BashTool.renderToolUseMessage({ command })}</Text>
				<Text color={theme.secondaryText}>{toolUseConfirm.description}</Text>
			</Box>

			<Box flexDirection="column">
				<Text>Do you want to proceed?</Text>
				<Select
					options={toolUseOptions({ toolUseConfirm, command })}
					onChange={(newValue) => {
						switch (newValue) {
							case "yes":
								logUnaryPermissionEvent(
									"tool_use_single",
									toolUseConfirm,
									"accept",
								);
								toolUseConfirm.onAllow("temporary");
								onDone();
								break;
							case "yes-dont-ask-again-prefix": {
								const prefix = toolUseConfirmGetPrefix(toolUseConfirm);
								if (prefix !== null) {
									logUnaryPermissionEvent(
										"tool_use_single",
										toolUseConfirm,
										"accept",
									);
									savePermission(
										toolUseConfirm.tool,
										toolUseConfirm.input,
										prefix,
									).then(() => {
										toolUseConfirm.onAllow("permanent");
										onDone();
									});
								}
								break;
							}
							case "yes-dont-ask-again-full":
								logUnaryPermissionEvent(
									"tool_use_single",
									toolUseConfirm,
									"accept",
								);
								savePermission(
									toolUseConfirm.tool,
									toolUseConfirm.input,
									null, // Save without prefix
								).then(() => {
									toolUseConfirm.onAllow("permanent");
									onDone();
								});
								break;
							case "no":
								logUnaryPermissionEvent(
									"tool_use_single",
									toolUseConfirm,
									"reject",
								);
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
