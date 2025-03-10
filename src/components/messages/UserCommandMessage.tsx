import { Box, Text } from "ink";
import type * as React from "react";
import { getTheme } from "../../utils/theme.js";
import { extractTag } from "../../utils/messages.js";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";

type Props = {
	addMargin: boolean;
	param: TextBlockParam;
};

export function UserCommandMessage({
	addMargin,
	param: { text },
}: Props): React.ReactNode {
	const commandMessage = extractTag(text, "command-message");
	const args = extractTag(text, "command-args");
	if (!commandMessage) {
		return null;
	}

	const theme = getTheme();
	return (
		<Box flexDirection="column" marginTop={addMargin ? 1 : 0} width="100%">
			<Text color={theme.secondaryText}>
				&gt; /{commandMessage} {args}
			</Text>
		</Box>
	);
}
