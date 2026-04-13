import { readFileSync } from "node:fs";
import { join } from "node:path";
import { uiManifestSchema } from "../manifest-schema";
import type { UIManifest } from "../types";

export {
	checkboxesField,
	dateField,
	datetimeField,
	emailField,
	numberField,
	selectField,
	textareaField,
	textField,
} from "./fields";
// Re-export all helpers from one import path
export {
	conventionAdminItem,
	coordinatorItem,
	item,
	page,
	sidebar,
} from "./pages";
export {
	agenda,
	approvalQueue,
	calendarDay,
	calendarGrid,
	calendarMonth,
	callout,
	cards,
	dataTable,
	detail,
	emptyState,
	form,
	hero,
	kanban,
	markdown,
	markdownEditor,
	searchSection,
	statsRow,
	tabs,
	timeline,
	upcomingStrip,
} from "./sections";

function readPackageVersion(): string {
	try {
		const pkg = JSON.parse(
			readFileSync(join(process.cwd(), "package.json"), "utf-8"),
		);
		return pkg.version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

interface DefineManifestInput {
	name: string;
	slug: string;
	icon?: string;
	accent?: string;
	version?: string;
	navigation?: UIManifest["navigation"];
	sidebar?: UIManifest["sidebar"];
	widgets?: UIManifest["widgets"];
	pages: UIManifest["pages"];
	permissions?: string[];
}

/**
 * Build and validate a UIManifest from a typed input object.
 *
 * - Defaults `version` from the calling service's package.json.
 * - Defaults `icon` to "cube" if not specified.
 * - Defaults `navigation` to a single entry with the service name.
 * - Runs `uiManifestSchema.parse()` at call time so invalid manifests
 *   surface immediately (at service boot), not at heartbeat time.
 */
export function defineManifest(input: DefineManifestInput): UIManifest {
	const version = input.version ?? readPackageVersion();
	const built = {
		name: input.name,
		icon: input.icon ?? "cube",
		accentColor: input.accent,
		version,
		navigation: input.navigation ?? [
			{ label: input.name, path: "/", icon: input.icon ?? "cube" },
		],
		sidebar: input.sidebar,
		widgets: input.widgets ?? [],
		pages: input.pages,
		permissions: input.permissions ?? [],
	};

	return uiManifestSchema.parse(built);
}
