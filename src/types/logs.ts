export type LogOption = {
	modified: Date;
	created: Date;
	messageCount: number;
	firstPrompt: string;
	forkNumber?: number;
	sidechainNumber?: number;
	value: any;
	messages: SerializedMessage[];
	fullPath: string;
	date: string;
};

export type LogListProps = {
	context: {
		unmount?: () => void;
	};
};

export type SerializedMessage = {
	type: "user";
	message: {
		content: string;
	};
	timestamp: string;
};
