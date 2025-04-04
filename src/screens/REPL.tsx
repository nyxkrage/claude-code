import type { ToolUseBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";
import { Box, Newline, Static } from "ink";
import ProjectOnboarding, {
	markProjectOnboardingComplete,
} from "../ProjectOnboarding.js";
import { CostThresholdDialog } from "../components/CostThresholdDialog.js";
import type * as React from "react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Command } from "../commands.js";
import { Logo } from "../components/Logo.js";
import { Message } from "../components/Message.js";
import { MessageResponse } from "../components/MessageResponse.js";
import { MessageSelector } from "../components/MessageSelector.js";
import {
	PermissionRequest,
	type ToolUseConfirm,
} from "../components/permissions/PermissionRequest.js";
import PromptInput from "../components/PromptInput.js";
import { Spinner } from "../components/Spinner.js";
import { getSystemPrompt } from "../constants/prompts.js";
import { getContext } from "../context.js";
import { getTotalCost, useCostSummary } from "../cost-tracker.js";
import { useLogStartupTime } from "../hooks/useLogStartupTime.js";
import { addToHistory } from "../history.js";
import { useApiKeyVerification } from "../hooks/useApiKeyVerification.js";
import { useCancelRequest } from "../hooks/useCancelRequest.js";
import useCanUseTool from "../hooks/useCanUseTool.js";
import { useLogMessages } from "../hooks/useLogMessages.js";
import { setMessagesGetter, setMessagesSetter } from "../messages.js";
import {
	type AssistantMessage,
	type BinaryFeedbackResult,
	type Message as MessageType,
	type ProgressMessage,
	query,
} from "../query.js";
import type { WrappedClient } from "../services/mcpClient.js";
import type { Tool } from "../Tool.js";
import type { AutoUpdaterResult } from "../utils/autoUpdater.js";
import { getGlobalConfig, saveGlobalConfig } from "../utils/config.js";
import { logEvent } from "../services/statsig.js";
import { getNextAvailableLogForkNumber } from "../utils/log.js";
import {
	getErroredToolUseMessages,
	getInProgressToolUseIDs,
	getLastAssistantMessageId,
	getToolUseID,
	getUnresolvedToolUseIDs,
	INTERRUPT_MESSAGE,
	isNotEmptyMessage,
	type NormalizedMessage,
	normalizeMessages,
	normalizeMessagesForAPI,
	processUserInput,
	reorderMessages,
} from "../utils/messages.js";
import { getSlowAndCapableModel } from "../utils/model.js";
import { clearTerminal, updateTerminalTitle } from "../utils/terminal.js";
import { BinaryFeedback } from "../components/binary-feedback/BinaryFeedback.js";
import { getMaxThinkingTokens } from "../utils/thinking.js";
import { getOriginalCwd } from "../utils/state.js";

type Props = {
	commands: Command[];
	dangerouslySkipPermissions?: boolean;
	debug?: boolean;
	initialForkNumber?: number | undefined;
	initialPrompt: string | undefined;
	// A unique name for the message log file, used to identify the fork
	messageLogName: string;
	shouldShowPromptInput: boolean;
	tools: Tool[];
	verbose: boolean | undefined;
	// Initial messages to populate the REPL with
	initialMessages?: MessageType[];
	// MCP clients
	mcpClients?: WrappedClient[];
	// Flag to indicate if current model is default
	isDefaultModel?: boolean;
};

export type BinaryFeedbackContext = {
	m1: AssistantMessage;
	m2: AssistantMessage;
	resolve: (result: BinaryFeedbackResult) => void;
};

export function REPL({
	commands,
	dangerouslySkipPermissions,
	debug = false,
	initialForkNumber = 0,
	initialPrompt,
	messageLogName,
	shouldShowPromptInput,
	tools,
	verbose: verboseFromCLI,
	initialMessages,
	mcpClients = [],
	isDefaultModel = true,
}: Props): React.ReactNode {
	// TODO: probably shouldn't re-read config from file synchronously on every keystroke
	const verbose = verboseFromCLI ?? getGlobalConfig().verbose;

	// Used to force the logo to re-render and conversation log to use a new file
	const [forkNumber, setForkNumber] = useState(
		getNextAvailableLogForkNumber(messageLogName, initialForkNumber, 0),
	);

	const [
		forkConvoWithMessagesOnTheNextRender,
		setForkConvoWithMessagesOnTheNextRender,
	] = useState<MessageType[] | null>(null);

	const [abortController, setAbortController] =
		useState<AbortController | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [autoUpdaterResult, setAutoUpdaterResult] =
		useState<AutoUpdaterResult | null>(null);
	const [toolJSX, setToolJSX] = useState<{
		jsx: React.ReactNode | null;
		shouldHidePromptInput: boolean;
	} | null>(null);
	const [toolUseConfirm, setToolUseConfirm] = useState<ToolUseConfirm | null>(
		null,
	);
	const [messages, setMessages] = useState<MessageType[]>(
		initialMessages ?? [],
	);
	const [inputValue, setInputValue] = useState("");
	const [inputMode, setInputMode] = useState<"bash" | "prompt">("prompt");
	const [submitCount, setSubmitCount] = useState(0);
	const [isMessageSelectorVisible, setIsMessageSelectorVisible] =
		useState(false);
	const [showCostDialog, setShowCostDialog] = useState(false);
	const [haveShownCostDialog, setHaveShownCostDialog] = useState(
		getGlobalConfig().hasAcknowledgedCostThreshold,
	);

	const [binaryFeedbackContext, setBinaryFeedbackContext] =
		useState<BinaryFeedbackContext | null>(null);

	const getBinaryFeedbackResponse = useCallback(
		(
			m1: AssistantMessage,
			m2: AssistantMessage,
		): Promise<BinaryFeedbackResult> => {
			return new Promise<BinaryFeedbackResult>((resolvePromise) => {
				setBinaryFeedbackContext({
					m1,
					m2,
					resolve: resolvePromise,
				});
			});
		},
		[],
	);

	const readFileTimestamps = useRef<{
		[filename: string]: number;
	}>({});

	const { status: apiKeyStatus, reverify } = useApiKeyVerification();
	function onCancel() {
		if (!isLoading) {
			return;
		}
		setIsLoading(false);
		if (toolUseConfirm) {
			// Tool use confirm handles the abort signal itself
			toolUseConfirm.onAbort();
		} else {
			abortController?.abort();
		}
	}

	useCancelRequest(
		setToolJSX,
		setToolUseConfirm,
		setBinaryFeedbackContext,
		onCancel,
		isLoading,
		isMessageSelectorVisible,
		abortController?.signal,
	);

	useEffect(() => {
		if (forkConvoWithMessagesOnTheNextRender) {
			setForkNumber((_) => _ + 1);
			setForkConvoWithMessagesOnTheNextRender(null);
			setMessages(forkConvoWithMessagesOnTheNextRender);
		}
	}, [forkConvoWithMessagesOnTheNextRender]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: getTotalCost relies on side effects so messages should be a dependency (i think)
	useEffect(() => {
		const totalCost = getTotalCost();
		if (totalCost >= 5 /* $5 */ && !showCostDialog && !haveShownCostDialog) {
			logEvent("tengu_cost_threshold_reached", {});
			setShowCostDialog(true);
		}
	}, [messages, showCostDialog, haveShownCostDialog]);

	const canUseTool = useCanUseTool(setToolUseConfirm);

	async function onInit() {
		reverify();

		if (!initialPrompt) {
			return;
		}

		setIsLoading(true);

		const abortController = new AbortController();
		setAbortController(abortController);

		const model = await getSlowAndCapableModel();
		const newMessages = await processUserInput(
			initialPrompt,
			"prompt",
			setToolJSX,
			{
				abortController,
				options: {
					commands,
					forkNumber,
					messageLogName,
					tools,
					verbose,
					slowAndCapableModel: model,
					maxThinkingTokens: 0,
				},
				messageId: getLastAssistantMessageId(messages),
				setForkConvoWithMessagesOnTheNextRender,
				readFileTimestamps: readFileTimestamps.current,
			},
			null,
		);

		if (newMessages.length) {
			for (const message of newMessages) {
				if (message.type === "user") {
					addToHistory(initialPrompt);
					// TODO: setHistoryIndex
				}
			}
			setMessages((_) => [..._, ...newMessages]);

			// The last message is an assistant message if the user input was a bash command,
			// or if the user input was an invalid slash command.
			const lastMessage = newMessages[newMessages.length - 1];
			if (lastMessage.type === "assistant") {
				setAbortController(null);
				setIsLoading(false);
				return;
			}

			const [systemPrompt, context, model, maxThinkingTokens] =
				await Promise.all([
					getSystemPrompt(),
					getContext(),
					getSlowAndCapableModel(),
					getMaxThinkingTokens([...messages, ...newMessages]),
				]);

			for await (const message of query(
				[...messages, ...newMessages],
				systemPrompt,
				context,
				canUseTool,
				{
					options: {
						commands,
						forkNumber,
						messageLogName,
						tools,
						slowAndCapableModel: model,
						verbose,
						dangerouslySkipPermissions,
						maxThinkingTokens,
					},
					messageId: getLastAssistantMessageId([...messages, ...newMessages]),
					readFileTimestamps: readFileTimestamps.current,
					abortController,
					setToolJSX,
				},
				getBinaryFeedbackResponse,
			)) {
				setMessages((oldMessages) => [...oldMessages, message]);
			}
		} else {
			addToHistory(initialPrompt);
			// TODO: setHistoryIndex
		}

		setHaveShownCostDialog(
			getGlobalConfig().hasAcknowledgedCostThreshold || false,
		);

		setIsLoading(false);
	}

	async function onQuery(
		newMessages: MessageType[],
		abortController: AbortController,
	) {
		setMessages((oldMessages) => [...oldMessages, ...newMessages]);

		// Mark onboarding as complete when any user message is sent to Claude
		markProjectOnboardingComplete();

		// The last message is an assistant message if the user input was a bash command,
		// or if the user input was an invalid slash command.
		const lastMessage = newMessages[newMessages.length - 1];

		// Update terminal title based on user message
		if (
			lastMessage.type === "user" &&
			typeof lastMessage.message.content === "string"
		) {
			updateTerminalTitle(lastMessage.message.content);
		}
		if (lastMessage.type === "assistant") {
			setAbortController(null);
			setIsLoading(false);
			return;
		}

		const [systemPrompt, context, model, maxThinkingTokens] = await Promise.all(
			[
				getSystemPrompt(),
				getContext(),
				getSlowAndCapableModel(),
				getMaxThinkingTokens([...messages, lastMessage]),
			],
		);

		// query the API
		for await (const message of query(
			[...messages, lastMessage],
			systemPrompt,
			context,
			canUseTool,
			{
				options: {
					commands,
					forkNumber,
					messageLogName,
					tools,
					slowAndCapableModel: model,
					verbose,
					dangerouslySkipPermissions,
					maxThinkingTokens,
				},
				messageId: getLastAssistantMessageId([...messages, lastMessage]),
				readFileTimestamps: readFileTimestamps.current,
				abortController,
				setToolJSX,
			},
			getBinaryFeedbackResponse,
		)) {
			setMessages((oldMessages) => [...oldMessages, message]);
		}
		setIsLoading(false);
	}

	// Register cost summary tracker
	useCostSummary();

	// Register messages getter and setter
	useEffect(() => {
		const getMessages = () => messages;
		setMessagesGetter(getMessages);
		setMessagesSetter(setMessages);
	}, [messages]);

	// Record transcripts locally, for debugging and conversation recovery
	useLogMessages(messages, messageLogName, forkNumber);

	// Log startup time
	useLogStartupTime();

	// Initial load
	// TODO: fix this
	// biome-ignore lint/correctness/useExhaustiveDependencies: this was supressed in the original code
	useEffect(() => {
		onInit();
	}, []);

	const normalizedMessages = useMemo(
		() => normalizeMessages(messages).filter(isNotEmptyMessage),
		[messages],
	);

	const unresolvedToolUseIDs = useMemo(
		() => getUnresolvedToolUseIDs(normalizedMessages),
		[normalizedMessages],
	);

	const inProgressToolUseIDs = useMemo(
		() => getInProgressToolUseIDs(normalizedMessages),
		[normalizedMessages],
	);

	const erroredToolUseIDs = useMemo(
		() =>
			new Set(
				getErroredToolUseMessages(normalizedMessages).map(
					(_) => (_.message.content[0] as ToolUseBlockParam).id,
				),
			),
		[normalizedMessages],
	);

	const messagesJSX = useMemo(() => {
		return [
			{
				type: "static",
				jsx: (
					<Box flexDirection="column" key={`logo${forkNumber}`}>
						<Logo mcpClients={mcpClients} isDefaultModel={isDefaultModel} />
						<ProjectOnboarding workspaceDir={getOriginalCwd()} />
					</Box>
				),
			},
			...reorderMessages(normalizedMessages).map((_, i) => {
				const toolUseID = getToolUseID(_);
				const message =
					_.type === "progress" ? (
						_.content.message.content[0]?.type === "text" &&
						// Hack: AgentTool interrupts use Progress messages, so don't
						// need an extra ⎿ because <Message /> already adds one.
						// TODO: Find a cleaner way to do this.
						_.content.message.content[0].text === INTERRUPT_MESSAGE ? (
							<Message
								// biome-ignore lint/suspicious/noArrayIndexKey: dont think there is a better option for the key
								key={i}
								message={_.content}
								messages={_.normalizedMessages}
								addMargin={false}
								tools={_.tools}
								verbose={verbose ?? false}
								debug={debug}
								erroredToolUseIDs={new Set()}
								inProgressToolUseIDs={new Set()}
								unresolvedToolUseIDs={new Set()}
								shouldAnimate={false}
								shouldShowDot={false}
							/>
						) : (
							// biome-ignore lint/suspicious/noArrayIndexKey: dont think there is a better option for the key
							<MessageResponse key={i}>
								<Message
									message={_.content}
									messages={_.normalizedMessages}
									addMargin={false}
									tools={_.tools}
									verbose={verbose ?? false}
									debug={debug}
									erroredToolUseIDs={new Set()}
									inProgressToolUseIDs={new Set()}
									unresolvedToolUseIDs={
										new Set([
											(_.content.message.content[0] as ToolUseBlockParam).id,
										])
									}
									shouldAnimate={false}
									shouldShowDot={false}
								/>
							</MessageResponse>
						)
					) : (
						<Message
							// biome-ignore lint/suspicious/noArrayIndexKey: dont think there is a better option for the key
							key={i}
							message={_}
							messages={normalizedMessages}
							addMargin={true}
							tools={tools}
							verbose={verbose}
							debug={debug}
							erroredToolUseIDs={erroredToolUseIDs}
							inProgressToolUseIDs={inProgressToolUseIDs}
							shouldAnimate={
								!toolJSX &&
								!toolUseConfirm &&
								!isMessageSelectorVisible &&
								(!toolUseID || inProgressToolUseIDs.has(toolUseID))
							}
							shouldShowDot={true}
							unresolvedToolUseIDs={unresolvedToolUseIDs}
						/>
					);

				const type = shouldRenderStatically(
					_,
					normalizedMessages,
					unresolvedToolUseIDs,
				)
					? "static"
					: "transient";

				if (debug) {
					return {
						type,
						jsx: (
							<Box
								borderStyle="single"
								borderColor={type === "static" ? "green" : "red"}
								key={_.uuid}
								width="100%"
							>
								{message}
							</Box>
						),
					};
				}

				return {
					type,
					jsx: (
						<Box key={_.uuid} width="100%">
							{message}
						</Box>
					),
				};
			}),
		];
	}, [
		forkNumber,
		normalizedMessages,
		tools,
		verbose,
		debug,
		erroredToolUseIDs,
		inProgressToolUseIDs,
		toolJSX,
		toolUseConfirm,
		isMessageSelectorVisible,
		unresolvedToolUseIDs,
		mcpClients,
		isDefaultModel,
	]);

	// only show the dialog once not loading
	const showingCostDialog = !isLoading && showCostDialog;

	return (
		<>
			<Static
				key={`static-messages-${forkNumber}`}
				items={messagesJSX.filter((_) => _.type === "static")}
			>
				{(_) => _.jsx}
			</Static>
			{messagesJSX.filter((_) => _.type === "transient").map((_) => _.jsx)}
			<Box
				borderColor="red"
				borderStyle={debug ? "single" : undefined}
				flexDirection="column"
				width="100%"
			>
				{!toolJSX && !toolUseConfirm && !binaryFeedbackContext && isLoading && (
					<Spinner />
				)}
				{toolJSX ? toolJSX.jsx : null}
				{!toolJSX && binaryFeedbackContext && !isMessageSelectorVisible && (
					<BinaryFeedback
						m1={binaryFeedbackContext.m1}
						m2={binaryFeedbackContext.m2}
						resolve={(result) => {
							binaryFeedbackContext.resolve(result);
							setTimeout(() => setBinaryFeedbackContext(null), 0);
						}}
						verbose={verbose}
						normalizedMessages={normalizedMessages}
						tools={tools}
						debug={debug}
						erroredToolUseIDs={erroredToolUseIDs}
						inProgressToolUseIDs={inProgressToolUseIDs}
						unresolvedToolUseIDs={unresolvedToolUseIDs}
					/>
				)}
				{!toolJSX &&
					toolUseConfirm &&
					!isMessageSelectorVisible &&
					!binaryFeedbackContext && (
						<PermissionRequest
							toolUseConfirm={toolUseConfirm}
							onDone={() => setToolUseConfirm(null)}
							verbose={verbose}
						/>
					)}
				{!toolJSX &&
					!toolUseConfirm &&
					!isMessageSelectorVisible &&
					!binaryFeedbackContext &&
					showingCostDialog && (
						<CostThresholdDialog
							onDone={() => {
								setShowCostDialog(false);
								setHaveShownCostDialog(true);
								const projectConfig = getGlobalConfig();
								saveGlobalConfig({
									...projectConfig,
									hasAcknowledgedCostThreshold: true,
								});
								logEvent("tengu_cost_threshold_acknowledged", {});
							}}
						/>
					)}

				{!toolUseConfirm &&
					!toolJSX?.shouldHidePromptInput &&
					shouldShowPromptInput &&
					!isMessageSelectorVisible &&
					!binaryFeedbackContext &&
					!showingCostDialog && (
						<PromptInput
							commands={commands}
							forkNumber={forkNumber}
							messageLogName={messageLogName}
							tools={tools}
							isDisabled={apiKeyStatus === "invalid"}
							isLoading={isLoading}
							onQuery={onQuery}
							debug={debug}
							verbose={verbose}
							messages={messages}
							setToolJSX={setToolJSX}
							onAutoUpdaterResult={setAutoUpdaterResult}
							autoUpdaterResult={autoUpdaterResult}
							input={inputValue}
							onInputChange={setInputValue}
							mode={inputMode}
							onModeChange={setInputMode}
							submitCount={submitCount}
							onSubmitCountChange={setSubmitCount}
							setIsLoading={setIsLoading}
							setAbortController={setAbortController}
							onShowMessageSelector={() =>
								setIsMessageSelectorVisible((prev) => !prev)
							}
							setForkConvoWithMessagesOnTheNextRender={
								setForkConvoWithMessagesOnTheNextRender
							}
							readFileTimestamps={readFileTimestamps.current}
						/>
					)}
			</Box>
			{isMessageSelectorVisible && (
				<MessageSelector
					erroredToolUseIDs={erroredToolUseIDs}
					unresolvedToolUseIDs={unresolvedToolUseIDs}
					messages={normalizeMessagesForAPI(messages)}
					onSelect={async (message) => {
						setIsMessageSelectorVisible(false);

						// If the user selected the current prompt, do nothing
						if (!messages.includes(message)) {
							return;
						}

						// Cancel tool use calls/requests
						onCancel();

						// Hack: make sure the "Interrupted by user" message is
						// rendered in response to the cancellation. Otherwise,
						// the screen will be cleared but there will remain a
						// vestigial "Interrupted by user" message at the top.
						setImmediate(async () => {
							// Clear messages, and re-render
							await clearTerminal();
							setMessages([]);
							setForkConvoWithMessagesOnTheNextRender(
								messages.slice(0, messages.indexOf(message)),
							);

							// Populate/reset the prompt input
							if (typeof message.message.content === "string") {
								setInputValue(message.message.content);
							}
						});
					}}
					onEscape={() => setIsMessageSelectorVisible(false)}
					tools={tools}
				/>
			)}
			{/** Fix occasional rendering artifact */}
			<Newline />
		</>
	);
}

function shouldRenderStatically(
	message: NormalizedMessage,
	messages: NormalizedMessage[],
	unresolvedToolUseIDs: Set<string>,
): boolean {
	switch (message.type) {
		case "user":
		case "assistant": {
			const toolUseID = getToolUseID(message);
			if (!toolUseID) {
				return true;
			}
			if (unresolvedToolUseIDs.has(toolUseID)) {
				return false;
			}

			const correspondingProgressMessage = messages.find(
				(_) => _.type === "progress" && _.toolUseID === toolUseID,
			) as ProgressMessage | null;
			if (!correspondingProgressMessage) {
				return true;
			}

			return !intersects(
				unresolvedToolUseIDs,
				correspondingProgressMessage.siblingToolUseIDs,
			);
		}
		case "progress":
			return !intersects(unresolvedToolUseIDs, message.siblingToolUseIDs);
	}
}

function intersects<A>(a: Set<A>, b: Set<A>): boolean {
	return a.size > 0 && b.size > 0 && [...a].some((_) => b.has(_));
}
