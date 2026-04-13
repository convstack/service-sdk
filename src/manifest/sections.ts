import type {
	AgendaConfig,
	ApprovalQueueConfig,
	CalendarDayConfig,
	CalendarGridConfig,
	CalendarMonthConfig,
	CalloutConfig,
	CardsConfig,
	DataTableConfig,
	DetailConfig,
	EmptyStateConfig,
	FormConfig,
	HeroConfig,
	JsonValue,
	KanbanConfig,
	PageSection,
	StatsRowConfig,
	TabsConfig,
	TimelineConfig,
	UpcomingStripConfig,
} from "../types";

export function dataTable(
	endpoint: string,
	config: Partial<DataTableConfig> = {},
): PageSection {
	return { type: "data-table", endpoint, config };
}

export function form(endpoint: string, config: FormConfig): PageSection {
	return { type: "form", endpoint, config };
}

export function detail(
	endpoint: string,
	config: Partial<DetailConfig> = {},
): PageSection {
	return { type: "detail", endpoint, config };
}

export function markdown(
	endpoint: string,
	config: Record<string, JsonValue> = {},
): PageSection {
	return { type: "markdown", endpoint, config };
}

export function markdownEditor(
	endpoint: string,
	config: Record<string, JsonValue> = {},
): PageSection {
	return { type: "markdown-editor", endpoint, config };
}

export function searchSection(
	endpoint: string,
	config: { rowLink?: string } = {},
): PageSection {
	return { type: "search", endpoint, config };
}

export function cards(
	endpoint: string,
	config: Partial<CardsConfig> = {},
): PageSection {
	return { type: "cards", endpoint, config };
}

export function tabs(config: TabsConfig): PageSection {
	// TabsConfig contains nested interfaces that don't carry an index signature,
	// so we cast through unknown to satisfy PageSection's config wire type.
	return {
		type: "tabs",
		endpoint: "",
		config: config as unknown as Record<string, JsonValue>,
	};
}

export function statsRow(
	endpoint: string,
	config: Partial<StatsRowConfig> = {},
): PageSection {
	return { type: "stats-row", endpoint, config };
}

export function callout(config: CalloutConfig): PageSection {
	return { type: "callout", endpoint: "", config };
}

export function emptyState(config: EmptyStateConfig): PageSection {
	return { type: "empty-state", endpoint: "", config };
}

export function hero(
	endpoint: string,
	config: Partial<HeroConfig> = {},
): PageSection {
	return { type: "hero", endpoint, config };
}

export function timeline(
	endpoint: string,
	config: Partial<TimelineConfig> = {},
): PageSection {
	return { type: "timeline", endpoint, config };
}

export function calendarMonth(
	endpoint: string,
	config: Partial<CalendarMonthConfig> = {},
): PageSection {
	return { type: "calendar-month", endpoint, config };
}

export function calendarDay(
	endpoint: string,
	config: Partial<CalendarDayConfig> = {},
): PageSection {
	return { type: "calendar-day", endpoint, config };
}

export function calendarGrid(
	endpoint: string,
	config: Partial<CalendarGridConfig> = {},
): PageSection {
	return { type: "calendar-grid", endpoint, config };
}

export function agenda(
	endpoint: string,
	config: Partial<AgendaConfig> = {},
): PageSection {
	return { type: "agenda", endpoint, config };
}

export function upcomingStrip(
	endpoint: string,
	config: Partial<UpcomingStripConfig> = {},
): PageSection {
	return { type: "upcoming-strip", endpoint, config };
}

export function approvalQueue(
	endpoint: string,
	config: Partial<ApprovalQueueConfig> = {},
): PageSection {
	return { type: "approval-queue", endpoint, config };
}

export function kanban(
	endpoint: string,
	config: Partial<KanbanConfig> = {},
): PageSection {
	return { type: "kanban", endpoint, config };
}
