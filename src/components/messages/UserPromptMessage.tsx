import type React from "react";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";
import { Box, Text } from "ink";
import { getTheme } from "../../utils/theme.js";
import { logError } from "../../utils/log.js";
import { useTerminalSize } from "../../hooks/useTerminalSize.js";

type Props = {
	addMargin: boolean;
	param: TextBlockParam;
};

export function UserPromptMessage({
	addMargin,
	param: { text },
}: Props): React.ReactNode {
	const { columns } = useTerminalSize();
	if (!text) {
		logError("No content found in user prompt message");
		return null;
	}

	return (
		<Box flexDirection="row" marginTop={addMargin ? 1 : 0} width="100%">
			<Box minWidth={2} width={2}>
				<Text color={getTheme().secondaryText}>&gt;</Text>
			</Box>
			<Box flexDirection="column" width={columns - 4}>
				<Text color={getTheme().secondaryText} wrap="wrap">
					{text}
				</Text>
			</Box>
		</Box>
	);
}
