import type { Command } from "../commands.js";
import { PRODUCT_NAME } from "../constants/product.js";
import * as React from "react";
import { Box, Text, useInput } from "ink";
import { getTheme } from "../utils/theme.js";
import { PressEnterToContinue } from "./PressEnterToContinue.js";
import { MACRO } from "../constants/macro.js";

export function Help({
	commands,
	onClose,
}: {
	commands: Command[];
	onClose: () => void;
}): React.ReactNode {
	const theme = getTheme();
	const isInternal = process.env.USER_TYPE === "ant";
	const moreHelp = isInternal
		? "[ANT-ONLY] For more help: go/claude-cli or #claude-cli-feedback"
		: `Learn more at: ${MACRO.README_URL}`;

	const filteredCommands = commands.filter((cmd) => !cmd.isHidden);
	const [count, setCount] = React.useState(0);

	React.useEffect(() => {
		const timer = setTimeout(() => {
			if (count < 3) {
				setCount(count + 1);
			}
		}, 250);

		return () => clearTimeout(timer);
	}, [count]);

	useInput((_, key) => {
		if (key.return) onClose();
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold color={theme.claude}>
				{`${PRODUCT_NAME} v${MACRO.VERSION}`}
			</Text>

			<Box marginTop={1} flexDirection="column">
				<Text>
					{PRODUCT_NAME} is a beta research preview. Always review Claude&apos;s
					responses, especially when running code. Claude has read access to
					files in the current directory and can run commands and edit files
					with your permission.
				</Text>
			</Box>

			{count >= 1 && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Usage Modes:</Text>
					<Text>
						• REPL: <Text bold>claude</Text> (interactive session)
					</Text>
					<Text>
						• Non-interactive: <Text bold>claude -p &quot;question&quot;</Text>
					</Text>
					<Box marginTop={1}>
						<Text>
							Run <Text bold>claude -h</Text> for all command line options
						</Text>
					</Box>
				</Box>
			)}

			{count >= 2 && (
				<Box marginTop={1} flexDirection="column">
					<Text bold>Common Tasks:</Text>
					<Text>
						• Ask questions about your codebase{" "}
						<Text color={getTheme().secondaryText}>
							&gt; How does foo.py work?
						</Text>
					</Text>
					<Text>
						• Edit files{" "}
						<Text color={getTheme().secondaryText}>
							&gt; Update bar.ts to...
						</Text>
					</Text>
					<Text>
						• Fix errors{" "}
						<Text color={getTheme().secondaryText}>&gt; cargo build</Text>
					</Text>
					<Text>
						• Run commands{" "}
						<Text color={getTheme().secondaryText}>&gt; /help</Text>
					</Text>
					<Text>
						• Run bash commands{" "}
						<Text color={getTheme().secondaryText}>&gt; !ls</Text>
					</Text>
				</Box>
			)}

			{count >= 3 && (
				<Box marginTop={1} flexDirection="column">
					<Text bold>Interactive Mode Commands:</Text>

					<Box flexDirection="column">
						{filteredCommands.map((cmd, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: dont think there is a better key for this
							<Box key={i} marginLeft={1}>
								<Text bold>{`/${cmd.name}`}</Text>
								<Text> - {cmd.description}</Text>
							</Box>
						))}
					</Box>
				</Box>
			)}

			<Box marginTop={1}>
				<Text color={theme.secondaryText}>{moreHelp}</Text>
			</Box>

			<Box marginTop={2}>
				<PressEnterToContinue />
			</Box>
		</Box>
	);
}
