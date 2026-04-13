import type { NavigationItem, PageDefinition, ServiceSidebar } from "../types";

export function page(
	path: string,
	title: string,
	options: {
		layout?: PageDefinition["layout"];
		showBack?: boolean;
	} = {},
	sections: PageDefinition["sections"] = [],
): PageDefinition {
	return {
		path,
		title,
		layout: options.layout ?? "default",
		showBack: options.showBack,
		sections,
	};
}

export function sidebar(config: {
	items?: NavigationItem[];
	primaryAction?: { label: string; icon?: string; link: string };
	footerItems?: NavigationItem[];
	tree?: { endpoint: string };
}): ServiceSidebar {
	return config;
}

export function item(
	label: string,
	path: string,
	extras: {
		icon?: string;
		showWhen?: "coordinator" | "convention-admin";
	} = {},
): NavigationItem {
	return {
		label,
		path,
		icon: extras.icon ?? "circle",
		showWhen: extras.showWhen,
	};
}

export function coordinatorItem(
	label: string,
	path: string,
	extras: { icon?: string } = {},
): NavigationItem {
	return {
		label,
		path,
		icon: extras.icon ?? "circle",
		showWhen: "coordinator",
	};
}

export function conventionAdminItem(
	label: string,
	path: string,
	extras: { icon?: string } = {},
): NavigationItem {
	return {
		label,
		path,
		icon: extras.icon ?? "circle",
		showWhen: "convention-admin",
	};
}
