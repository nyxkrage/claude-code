import { ImageBlockParam } from "@anthropic-ai/sdk/resources/index.mjs";

export type NotebookCellType = "code" | "markdown";

export type NotebookOutputImage = {
	image_data: string;
	media_type: ImageBlockParam.Source["media_type"];
};

export type NotebookCellSourceOutput = {
	text: string;
	image?: NotebookOutputImage;
};

export type NotebookCellSource = {
	cell: number;
	cellType: NotebookCellType;
	source: string;
	language: string;
	execution_count?: number;
	outputs?: NotebookCellSourceOutput[];
};

export type NotebookCell = {
	cell_type: NotebookCellType;
	source: string | string[];
	execution_count?: number;
	outputs?: NotebookCellOutput[];
};

export type NotebookCellOutput =
	| {
			output_type: "stream";
			text: string;
	  }
	| {
			output_type: "execute_result" | "display_data";
			data?: {
				"text/plain"?: string | string[];
				"image/png"?: string;
				"image/jpeg"?: string;
			};
	  }
	| {
			output_type: "error";
			ename: string;
			evalue: string;
			traceback: string[];
	  };

export type NotebookContent = {
	metadata: {
		language_info: {
			name: string;
		};
	};
	cells: NotebookCell[];
};
