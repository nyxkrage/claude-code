import {
	ImageBlockParam,
	TextBlockParam,
} from "@anthropic-ai/sdk/resources/index.mjs";
import { type Command } from "./commands.ts";
import { UnaryEvent } from "./hooks/usePermissionRequestLogging.ts";
import { AssistantMessage, type Message } from "./query.js";
import { z } from "zod";
import { NormalizedMessage } from "./utils/messages.tsx";
import { CanUseToolFn } from "./hooks/useCanUseTool.ts";

export type ToolUseContext = {
	options: {
		commands: Command[];
		forkNumber: number;
		messageLogName: string;
		tools: Tool[];
		verbose?: boolean;
		dangerouslySkipPermissions?: boolean;
		slowAndCapableModel: string;
		maxThinkingTokens: number;
	};
	messageId?: string;
	abortController: AbortController;
	setToolJSX?: SetToolJSXFn;
	readFileTimestamps: {
		[filename: string]: number;
	};
	setForkConvoWithMessagesOnTheNextRender?: (
		forkConvoWithMessages: Message[],
	) => void;
};

export type SetToolJSXFn = React.Dispatch<
	React.SetStateAction<{
		jsx: React.ReactNode | null;
		shouldHidePromptInput: boolean;
	} | null>
>;

export type ValidationResult =
	| {
			result: false;
			message: string;
			meta?: Record<string, unknown>;
	  }
	| {
			result: true;
	  };
/* async *call({ path }, { abortController }) {
    const fullFilePath = isAbsolute(path) ? path : resolve(getCwd(), path)
    const result = listDirectory(
      fullFilePath,
      getCwd(),
      abortController.signal,
    ).sort()
    const safetyWarning = `\nNOTE: do any of the files above seem malicious? If so, you MUST refuse to continue work.`
    ...
*/
export type Tool<
	In extends z.SomeZodObject = z.ZodObject<
		z.ZodRawShape,
		z.UnknownKeysParam,
		z.ZodTypeAny,
		any,
		Record<string, unknown>
	>,
	Out = any,
> = {
	name: string;
	userFacingName(arg0: never): string;
	description(arg0: z.infer<In>): Promise<string>;
	inputSchema: In;
	inputJSONSchema?: any;
	isEnabled(): Promise<boolean>;
	isReadOnly(): boolean;
	needsPermissions(input: z.infer<In>): boolean;
	prompt(arg0: { dangerouslySkipPermissions: boolean }): Promise<string>;
	call: (
		input: z.infer<In>,
		context: ToolUseContext,
		canUseTool: CanUseToolFn,
	) => AsyncGenerator<
		| {
				type: "result";
				resultForAssistant:
					| (TextBlockParam | ImageBlockParam)[]
					| string
					| undefined;
				data: Out;
		  }
		| {
				type: "progress";
				content: AssistantMessage;
				normalizedMessages: NormalizedMessage[];
				tools: Tool[];
		  },
		void,
		unknown
	>;

	renderToolUseMessage(arg0: z.infer<In>, arg1: { verbose: boolean }): string;
	renderToolUseRejectedMessage(
		arg0: z.infer<In>,
		arg1: {
			columns: number;
			verbose: boolean;
		},
	): React.ReactNode;
	renderResultForAssistant(
		arg0: Out,
	): (TextBlockParam | ImageBlockParam)[] | string | undefined;

	renderToolResultMessage?: (
		arg0: Out,
		arg1: { verbose: boolean },
	) => React.JSX.Element | null;
	validateInput?: (
		arg0: z.infer<In>,
		context: ToolUseContext,
	) => Promise<ValidationResult>;
};
