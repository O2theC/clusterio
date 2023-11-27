import type * as lib from "@clusterio/lib";

import * as messages from "./messages";

export default {
	name: "research_sync",
	title: "Research Sync",
	description: "Synchronises technology research progress between instances.",
	instanceEntrypoint: "dist/plugin/instance",
	controllerEntrypoint: "dist/plugin/controller",

	messages: [
		messages.ContributionEvent,
		messages.ProgressEvent,
		messages.FinishedEvent,
		messages.SyncTechnologiesRequest,
	],
} satisfies lib.PluginDeclaration;
