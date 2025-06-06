import type * as React from "react";
import { extractTag } from "../../utils/messages.js";
import { getTheme } from "../../utils/theme.js";
import { Box, Text } from "ink";

export function AssistantLocalCommandOutputMessage({
	content,
}: {
	content: string;
}): React.ReactNode[] {
	const stdout = extractTag(content, "local-command-stdout");
	const stderr = extractTag(content, "local-command-stderr");
	if (!stdout && !stderr) {
		return [];
	}
	const theme = getTheme();
	let insides = [
		format(stdout?.trim(), theme.text),
		format(stderr?.trim(), theme.error),
	].filter(Boolean);

	if (insides.length === 0) {
		insides = [<Text key="0">(No output)</Text>];
	}

	return [
		<Box key="0" gap={1}>
			<Box>
				<Text color={theme.secondaryText}>{"  "}⎿ </Text>
			</Box>
			{insides.map((_, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: dont think there is a better key for this
				<Box key={index} flexDirection="column">
					{_}
				</Box>
			))}
		</Box>,
	];
}

function format(content: string | undefined, color: string): React.ReactNode {
	if (!content) {
		return null;
	}
	return <Text color={color}>{content}</Text>;
}
