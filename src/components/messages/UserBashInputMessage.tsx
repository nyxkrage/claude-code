import { Box, Text } from "ink";
import type * as React from "react";
import { extractTag } from "../../utils/messages.js";
import { getTheme } from "../../utils/theme.js";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";

type Props = {
	addMargin: boolean;
	param: TextBlockParam;
};

export function UserBashInputMessage({
	param: { text },
	addMargin,
}: Props): React.ReactNode {
	const input = extractTag(text, "bash-input");
	if (!input) {
		return null;
	}
	return (
		<Box flexDirection="column" marginTop={addMargin ? 1 : 0} width="100%">
			<Box>
				<Text color={getTheme().bashBorder}>!</Text>
				<Text color={getTheme().secondaryText}> {input}</Text>
			</Box>
		</Box>
	);
}
