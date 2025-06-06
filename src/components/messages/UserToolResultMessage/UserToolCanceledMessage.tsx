import { Text } from "ink";
import type * as React from "react";
import { getTheme } from "../../../utils/theme.js";

export function UserToolCanceledMessage(): React.ReactNode {
	return (
		<Text>
			&nbsp;&nbsp;⎿ &nbsp;
			<Text color={getTheme().error}>Interrupted by user</Text>
		</Text>
	);
}
