import type { Option, SelectProps } from "@inkjs/ui";
import chalk from "chalk";
import { Box, Text, useInput } from "ink";
import Link from "ink-link";
import React, { useState } from "react";
import { getTheme } from "../../utils/theme.js";
import { Select } from "../CustomSelect/index.js";
import type { Tool } from "../../Tool.js";
import type { NormalizedMessage } from "../../utils/messages.js";
import { BinaryFeedbackOption as BinaryFeedbackOptionComponent } from "./BinaryFeedbackOption.js";
import type { AssistantMessage } from "../../query.js";
import type { BinaryFeedbackChoose } from "./utils.js";
import { useExitOnCtrlCD } from "../../hooks/useExitOnCtrlCD.js";
import type { BinaryFeedbackChoice } from "./utils.js";

const HELP_URL = "https://go/cli-feedback";

type BinaryFeedbackOption = Option & { value: BinaryFeedbackChoice };

// Make options a function to avoid early theme access during module initialization
export function getOptions(): BinaryFeedbackOption[] {
	return [
		{
			// This option combines the follow user intents:
			// - The two options look about equally good to me
			// - I don't feel confident enough to choose
			// - I don't want to choose right now
			label: "Choose for me",
			value: "no-preference",
		},
		{
			label: "Left option looks better",
			value: "prefer-left",
		},
		{
			label: "Right option looks better",
			value: "prefer-right",
		},
		{
			label: `Neither, and tell Claude what to do differently (${chalk.bold.hex(getTheme().warning)("esc")})`,
			value: "neither",
		},
	];
}

type Props = {
	m1: AssistantMessage;
	m2: AssistantMessage;
	onChoose?: BinaryFeedbackChoose;
	debug: boolean;
	erroredToolUseIDs: Set<string>;
	inProgressToolUseIDs: Set<string>;
	normalizedMessages: NormalizedMessage[];
	tools: Tool[];
	unresolvedToolUseIDs: Set<string>;
	verbose: boolean;
};

export function BinaryFeedbackView({
	m1,
	m2,
	onChoose,
	debug,
	erroredToolUseIDs,
	inProgressToolUseIDs,
	normalizedMessages,
	tools,
	unresolvedToolUseIDs,
	verbose,
}: Props) {
	const theme = getTheme();
	const [focused, setFocus] = useState("no-preference");
	const [focusValue, setFocusValue] = useState<string | undefined>(undefined);
	const exitState = useExitOnCtrlCD(() => process.exit(1));

	useInput((_input, key) => {
		if (key.leftArrow) {
			setFocusValue("prefer-left");
		} else if (key.rightArrow) {
			setFocusValue("prefer-right");
		} else if (key.escape) {
			onChoose?.("neither");
		}
	});

	return (
		<>
			<Box
				flexDirection="column"
				height="100%"
				width="100%"
				borderStyle="round"
				borderColor={theme.permission}
			>
				<Box width="100%" justifyContent="space-between" paddingX={1}>
					<Text bold color={theme.permission}>
						[ANT-ONLY] Help train Claude
					</Text>
					<Text>
						<Link url={HELP_URL}>[?]</Link>
					</Text>
				</Box>
				<Box flexDirection="row" width="100%" flexGrow={1} paddingTop={1}>
					<Box
						flexDirection="column"
						flexGrow={1}
						flexBasis={1}
						gap={1}
						borderStyle={focused === "prefer-left" ? "bold" : "single"}
						borderColor={
							focused === "prefer-left" ? theme.success : theme.secondaryBorder
						}
						marginRight={1}
						padding={1}
					>
						<BinaryFeedbackOptionComponent
							erroredToolUseIDs={erroredToolUseIDs}
							debug={debug}
							inProgressToolUseIDs={inProgressToolUseIDs}
							message={m1}
							normalizedMessages={normalizedMessages}
							tools={tools}
							unresolvedToolUseIDs={unresolvedToolUseIDs}
							verbose={verbose}
						/>
					</Box>
					<Box
						flexDirection="column"
						flexGrow={1}
						flexBasis={1}
						gap={1}
						borderStyle={focused === "prefer-right" ? "bold" : "single"}
						borderColor={
							focused === "prefer-right" ? theme.success : theme.secondaryBorder
						}
						marginLeft={1}
						padding={1}
					>
						<BinaryFeedbackOptionComponent
							erroredToolUseIDs={erroredToolUseIDs}
							debug={debug}
							inProgressToolUseIDs={inProgressToolUseIDs}
							message={m2}
							normalizedMessages={normalizedMessages}
							tools={tools}
							unresolvedToolUseIDs={unresolvedToolUseIDs}
							verbose={verbose}
						/>
					</Box>
				</Box>
				<Box flexDirection="column" paddingTop={1} paddingX={1}>
					<Text>How do you want to proceed?</Text>
					<Select
						options={getOptions()}
						onFocus={setFocus}
						focusValue={focusValue}
						onChange={onChoose as SelectProps["onChange"]}
					/>
				</Box>
			</Box>
			{exitState.pending ? (
				<Box marginLeft={3}>
					<Text dimColor>Press {exitState.keyName} again to exit</Text>
				</Box>
			) : (
				// Render a blank line so that the UI doesn't reflow when the exit message is shown
				<Text> </Text>
			)}
		</>
	);
}
