import { z } from "zod";

/* ============================================================================
 * Generic JSON value (recursive)
 * ========================================================================== */

export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

/* ============================================================================
 * Navigation
 * ========================================================================== */

export interface NavigationItem {
	label: string;
	path: string;
	icon: string;
	href?: string;
	badge?: { endpoint: string };
	children?: NavigationItem[];
	requiredPermission?: string;
	showWhen?: "coordinator" | "convention-admin";
}

export const navigationItemSchema: z.ZodType<NavigationItem> = z.lazy(() =>
	z.object({
		label: z.string().min(1).max(50),
		path: z
			.string()
			.min(1)
			.max(200)
			.regex(
				/^\/[a-z0-9\-/]*$/,
				"Path must start with / and contain only lowercase alphanumeric characters, hyphens, and slashes",
			),
		icon: z.string().min(1).max(50),
		badge: z.object({ endpoint: z.string().min(1).max(500) }).optional(),
		children: z.array(navigationItemSchema).max(10).optional(),
		requiredPermission: z.string().max(100).optional(),
		showWhen: z.enum(["coordinator", "convention-admin"]).optional(),
	}),
);

/* ============================================================================
 * Sidebar
 * ========================================================================== */

export const serviceSidebarSchema = z.object({
	primaryAction: z
		.object({
			label: z.string().min(1).max(50),
			icon: z.string().max(50).optional(),
			link: z.string().min(1).max(200),
		})
		.optional(),
	items: z.array(navigationItemSchema).max(30).optional(),
	tree: z
		.object({
			endpoint: z.string().min(1).max(500),
		})
		.optional(),
	footerItems: z.array(navigationItemSchema).max(30).optional(),
});

/* ============================================================================
 * Widgets
 * ========================================================================== */

export const widgetDefinitionSchema = z.object({
	id: z.string().min(1).max(100),
	type: z.enum(["stat", "chart", "table", "list", "progress"]),
	label: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	endpoint: z.string().min(1).max(500),
	refreshInterval: z.number().int().min(0).max(3600).optional(),
	size: z.enum(["sm", "md", "lg", "full"]),
	requiredPermission: z.string().max(100).optional(),
});

/* ============================================================================
 * Page sections
 * ========================================================================== */

export const pageSectionSchema = z.object({
	type: z.enum([
		"data-table",
		"form",
		"detail",
		"widget-grid",
		"action-bar",
		"two-factor",
		"passkey-manager",
		"markdown",
		"markdown-editor",
		"search",
		"cards",
		"tabs",
		"stats-row",
		"callout",
		"empty-state",
		"hero",
		"timeline",
		"calendar-month",
		"calendar-day",
		"calendar-grid",
		"agenda",
		"upcoming-strip",
		"approval-queue",
		"kanban",
		"custom",
	]),
	endpoint: z.string().max(500),
	config: z.record(z.string(), jsonValueSchema),
});

export const pageDefinitionSchema = z.object({
	path: z.string().min(1).max(200),
	title: z.string().min(1).max(100),
	layout: z.enum(["default", "split", "reading", "wide", "full", "full-width"]),
	sections: z.array(pageSectionSchema).max(20),
	showBack: z.boolean().optional(),
	requiredPermission: z.string().max(100).optional(),
});

/* ============================================================================
 * UIManifest (top-level)
 * ========================================================================== */

export const uiManifestSchema = z.object({
	name: z.string().min(1).max(100),
	icon: z.string().min(1).max(50),
	// Optional per-service accent color (hex or OKLCH).
	accentColor: z.string().max(64).optional(),
	version: z.string().max(20).default("1"),
	navigation: z.array(navigationItemSchema).max(30),
	widgets: z.array(widgetDefinitionSchema).max(50),
	pages: z.array(pageDefinitionSchema).max(50),
	permissions: z.array(z.string().max(100)).max(100),
	sidebar: serviceSidebarSchema.optional(),
});

export type ServiceSidebar = z.infer<typeof serviceSidebarSchema>;
export type WidgetDefinition = z.infer<typeof widgetDefinitionSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageDefinition = z.infer<typeof pageDefinitionSchema>;
export type UIManifest = z.infer<typeof uiManifestSchema>;

/* ============================================================================
 * Section config types — shape of section.config per section type. Not
 * validated at the manifest layer; the dashboard casts to them at render time.
 * ========================================================================== */

export const badgeValueSchema = z.object({
	label: z.string(),
	variant: z
		.enum(["default", "success", "warning", "danger", "info"])
		.optional(),
});
export type BadgeValue = z.infer<typeof badgeValueSchema>;

export const rowActionSchema = z.object({
	label: z.string(),
	endpoint: z.string(),
	method: z.enum(["POST", "PUT", "DELETE"]),
	variant: z.enum(["default", "danger"]).optional(),
	confirm: z.string().optional(),
	link: z.string().optional(),
	redirect: z.string().optional(),
});
export type RowAction = z.infer<typeof rowActionSchema>;

export const emptyStateActionSchema = z.object({
	label: z.string(),
	link: z.string().optional(),
	endpoint: z.string().optional(),
	method: z.enum(["POST", "PUT", "DELETE"]).optional(),
});
export type EmptyStateAction = z.infer<typeof emptyStateActionSchema>;

export const emptyStateConfigSchema = z.object({
	icon: z.string().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	action: emptyStateActionSchema.optional(),
});
export type EmptyStateConfig = z.infer<typeof emptyStateConfigSchema>;

/* ----- Top bar contribution (returned by page endpoints, not part of manifest) ----- */

export const topBarContributionSchema = z.object({
	breadcrumbs: z
		.array(
			z.object({
				label: z.string(),
				href: z.string().optional(),
				icon: z.string().optional(),
			}),
		)
		.optional(),
	actions: z
		.array(
			z.object({
				id: z.string(),
				label: z.string(),
				icon: z.string().optional(),
				link: z.string().optional(),
				endpoint: z.string().optional(),
				method: z.enum(["POST", "PUT", "DELETE"]).optional(),
				variant: z.enum(["primary", "default", "danger"]).optional(),
				confirm: z.string().optional(),
			}),
		)
		.optional(),
	universal: z.array(z.enum(["star", "share", "more"])).optional(),
});
export type TopBarContribution = z.infer<typeof topBarContributionSchema>;

/* ----- DataTable ----- */

export const dataTableColumnSchema = z.object({
	key: z.string(),
	label: z.string(),
	type: z
		.enum([
			"string",
			"number",
			"date",
			"currency",
			"badge",
			"avatar",
			"link",
			"code",
		])
		.optional(),
	sortable: z.boolean().optional(),
	currency: z.string().optional(),
});
export type DataTableColumn = z.infer<typeof dataTableColumnSchema>;

export const dataTableConfigSchema = z.object({
	title: z.string().optional(),
	rowLink: z.string().optional(),
	rowActions: z.array(rowActionSchema).optional(),
	createLink: z.string().optional(),
	createLabel: z.string().optional(),
	readOnly: z.boolean().optional(),
	sortable: z.boolean().optional(),
	filterable: z.boolean().optional(),
	emptyState: emptyStateConfigSchema.optional(),
});
export type DataTableConfig = z.infer<typeof dataTableConfigSchema>;

/* ----- Detail ----- */

export const detailFieldSchema = z.object({
	key: z.string(),
	label: z.string(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
	type: z
		.enum([
			"string",
			"number",
			"boolean",
			"date",
			"link",
			"badge",
			"code",
			"multiline",
		])
		.optional(),
});
export type DetailField = z.infer<typeof detailFieldSchema>;

export const detailGroupSchema = z.object({
	title: z.string(),
	fields: z.array(detailFieldSchema),
});
export type DetailGroup = z.infer<typeof detailGroupSchema>;

export const detailConfigSchema = z.object({
	title: z.string().optional(),
});
export type DetailConfig = z.infer<typeof detailConfigSchema>;

/* ----- Form ----- */

export const formConfigSchema = z.object({
	title: z.string().optional(),
	fields: z.array(
		z.object({
			key: z.string(),
			label: z.string(),
			type: z.enum([
				"text",
				"number",
				"email",
				"select",
				"textarea",
				"password",
				"file",
				"search",
				"checkboxes",
				// Renders <input type="datetime-local"> — browser date+time
				// picker, no timezone. Form converts local ↔ ISO on
				// read/write so the wire value is always ISO 8601 UTC.
				"datetime",
				// Renders <input type="date"> — date only. Wire value is
				// ISO date string YYYY-MM-DD.
				"date",
			]),
			required: z.boolean().optional(),
			placeholder: z.string().optional(),
			options: z
				.array(z.object({ label: z.string(), value: z.string() }))
				.optional(),
			uploadEndpoint: z.string().optional(),
			accept: z.string().optional(),
			searchEndpoint: z.string().optional(),
			searchResultLabel: z.string().optional(),
			searchResultValue: z.string().optional(),
		}),
	),
	submitLabel: z.string().optional(),
	submitEndpoint: z.string().optional(),
	method: z.string().optional(),
});
export type FormConfig = z.infer<typeof formConfigSchema>;

/* ----- Cards ----- */

export const cardsConfigSchema = z.object({
	title: z.string().optional(),
	columns: z
		.object({
			sm: z
				.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
				.optional(),
			md: z
				.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
				.optional(),
			lg: z
				.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
				.optional(),
		})
		.optional(),
	emptyState: emptyStateConfigSchema.optional(),
});
export type CardsConfig = z.infer<typeof cardsConfigSchema>;

/* ----- Tabs ----- */

// Forward declaration: TabDefinition.sections is PageSection[].
export interface TabDefinition {
	key: string;
	label: string;
	icon?: string;
	sections: PageSection[];
}

export const tabDefinitionSchema: z.ZodType<TabDefinition> = z.lazy(() =>
	z.object({
		key: z.string(),
		label: z.string(),
		icon: z.string().optional(),
		sections: z.array(pageSectionSchema),
	}),
);

export const tabsConfigSchema = z.object({
	tabs: z.array(tabDefinitionSchema),
	default: z.string().optional(),
});
export type TabsConfig = z.infer<typeof tabsConfigSchema>;

/* ----- StatsRow ----- */

export const statsRowConfigSchema = z.object({
	title: z.string().optional(),
});
export type StatsRowConfig = z.infer<typeof statsRowConfigSchema>;

/* ----- Callout ----- */

export const calloutConfigSchema = z.object({
	variant: z.enum(["info", "success", "warning", "danger", "tip"]),
	title: z.string().optional(),
	body: z.string(),
	icon: z.string().optional(),
});
export type CalloutConfig = z.infer<typeof calloutConfigSchema>;

/* ----- Hero ----- */

export const heroActionSchema = z.object({
	label: z.string(),
	link: z.string().optional(),
	variant: z.enum(["primary", "default", "danger"]).optional(),
});
export type HeroAction = z.infer<typeof heroActionSchema>;

export const heroConfigSchema = z.object({
	title: z.string(),
	subtitle: z.string().optional(),
	avatar: z.string().optional(),
	icon: z.string().optional(),
	badges: z.array(badgeValueSchema).optional(),
	metadata: z
		.array(z.object({ label: z.string(), value: z.string() }))
		.optional(),
	actions: z.array(heroActionSchema).optional(),
});
export type HeroConfig = z.infer<typeof heroConfigSchema>;

/* ----- Timeline ----- */

export const timelineConfigSchema = z.object({
	title: z.string().optional(),
	emptyState: emptyStateConfigSchema.optional(),
});
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;

// ─── Schedule schemas ─────────────────────────────────────────────

export const scheduleEventLinksSchema = z.object({
	self: z.string().optional(),
	update: z.string().optional(),
	delete: z.string().optional(),
	// Lifecycle transitions — present on shifts where the requesting user
	// is a coordinator and the shift's current status allows the transition.
	// `publish` appears on draft shifts; `archive` appears on published shifts.
	publish: z.string().optional(),
	archive: z.string().optional(),
	// Critter shift request — present on published shifts for authenticated
	// users who aren't coordinators of the shift's department.
	request: z.string().optional(),
});

export const schedulePresenterSchema = z.object({
	name: z.string(),
	avatar: z.string().optional(),
	link: z.string().optional(),
});

export const scheduleEventSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		start: z.string(),
		end: z.string(),
		timezone: z.string(),
		rrule: z.string().optional(),
		exdates: z.array(z.string()).optional(),
		trackId: z.string().optional(),
		location: z.string().optional(),
		description: z.string().optional(),
		link: z.string().optional(),
		status: z.enum(["scheduled", "tentative", "cancelled"]).optional(),
		category: z.string().optional(),
		presenters: z.array(schedulePresenterSchema).optional(),
		_meta: z
			.object({
				// Per-user assignment status hint for "my shifts" views. Dashboard's
				// agenda renderer keys off this to render pending vs confirmed badges.
				assignmentStatus: z
					.enum(["requested", "approved", "declined", "withdrawn"])
					.optional(),
			})
			.optional(),
		_links: scheduleEventLinksSchema.optional(),
	})
	.refine((e) => new Date(e.end).getTime() > new Date(e.start).getTime(), {
		message: "Event end must be after start",
		path: ["end"],
	});

export const scheduleTrackSchema = z.object({
	id: z.string(),
	label: z.string(),
	accentColor: z.string().optional(),
});

export const scheduleDataLinksSchema = z.object({
	create: z.string().optional(),
	createForm: formConfigSchema.optional(),
	editForm: formConfigSchema.optional(),
});

export const scheduleDataSchema = z.object({
	events: z.array(scheduleEventSchema),
	tracks: z.array(scheduleTrackSchema).optional(),
	_links: scheduleDataLinksSchema.optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

const hourRangeSchema = z
	.tuple([z.number().min(0).max(23), z.number().min(1).max(24)])
	.refine(([a, b]) => b > a, "hourRange end must be greater than start");

export const calendarMonthConfigSchema = z.object({
	title: z.string().optional(),
	weekStartsOn: z.enum(["mon", "sun"]).default("mon"),
	categoryColors: z.record(z.string(), z.string()).optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export const calendarDayConfigSchema = z.object({
	title: z.string().optional(),
	hourRange: hourRangeSchema.default([8, 22]),
	categoryColors: z.record(z.string(), z.string()).optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export const calendarGridConfigSchema = z.object({
	title: z.string().optional(),
	hourRange: hourRangeSchema.default([8, 22]),
	categoryColors: z.record(z.string(), z.string()).optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export const agendaConfigSchema = z.object({
	title: z.string().optional(),
	groupBy: z.enum(["day", "week"]).default("day"),
	showPastEvents: z.boolean().default(false),
	categoryColors: z.record(z.string(), z.string()).optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export const upcomingStripConfigSchema = z.object({
	title: z.string().optional(),
	maxItems: z.number().min(1).max(20).default(5),
	categoryColors: z.record(z.string(), z.string()).optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export type ScheduleEvent = z.infer<typeof scheduleEventSchema>;
export type ScheduleTrack = z.infer<typeof scheduleTrackSchema>;
export type ScheduleData = z.infer<typeof scheduleDataSchema>;
export type ScheduleEventLinks = z.infer<typeof scheduleEventLinksSchema>;
export type SchedulePresenter = z.infer<typeof schedulePresenterSchema>;
export type CalendarMonthConfig = z.infer<typeof calendarMonthConfigSchema>;
export type CalendarDayConfig = z.infer<typeof calendarDayConfigSchema>;
export type CalendarGridConfig = z.infer<typeof calendarGridConfigSchema>;
export type AgendaConfig = z.infer<typeof agendaConfigSchema>;
export type UpcomingStripConfig = z.infer<typeof upcomingStripConfigSchema>;

// ─── Approval queue section ──────────────────────────────────────

export const approvalQueueConfigSchema = z.object({
	title: z.string().optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

// Per-item shape inside the queue response. Not a full ScheduleEvent — this
// is a flat list optimized for review, not a calendar.
export const approvalQueueItemSchema = z.object({
	id: z.string(),
	shift: z.object({
		id: z.string(),
		title: z.string(),
		start: z.string(),
		end: z.string(),
		location: z.string().optional(),
		capacity: z.number(),
		filledCount: z.number(),
		departmentId: z.string(),
		departmentName: z.string(),
	}),
	critter: z.object({
		userId: z.string(),
		name: z.string(),
		hasProfile: z.boolean(),
		profile: z
			.object({
				shirtSize: z.string().optional(),
				dietary: z.string().optional(),
				skills: z.array(z.string()).optional(),
				availabilityNote: z.string().optional(),
			})
			.optional(),
	}),
	requestedAt: z.string(),
	requestNote: z.string().optional(),
	conflicts: z
		.array(
			z.object({
				shiftId: z.string(),
				title: z.string(),
				start: z.string(),
				end: z.string(),
				status: z.enum(["requested", "approved"]),
			}),
		)
		.optional(),
	_links: z
		.object({
			approve: z.string().optional(),
			decline: z.string().optional(),
		})
		.optional(),
});

export const approvalQueueDataSchema = z.object({
	items: z.array(approvalQueueItemSchema),
	total: z.number(),
	emptyState: emptyStateConfigSchema.optional(),
});

// ─── Critter profile ──────────────────────────────────────────────

export const critterProfileSchema = z.object({
	userId: z.string().optional(), // server fills on write
	shirtSize: z.enum(["xs", "s", "m", "l", "xl", "2xl", "3xl"]).optional(),
	dietary: z.string().max(500).optional(),
	emergencyContact: z.string().max(200).optional(),
	skills: z.array(z.string().max(64)).max(20).optional(),
	availabilityNote: z.string().max(500).optional(),
});

// ─── Convention settings ──────────────────────────────────────────

export const conventionSettingsSchema = z.object({
	conventionName: z.string().min(1).max(200),
	conventionTz: z.string().min(1),
	conventionStartsOn: z.string().datetime().nullable().optional(),
	conventionEndsOn: z.string().datetime().nullable().optional(),
});

export type ApprovalQueueConfig = z.infer<typeof approvalQueueConfigSchema>;
export type ApprovalQueueItem = z.infer<typeof approvalQueueItemSchema>;
export type ApprovalQueueData = z.infer<typeof approvalQueueDataSchema>;
export type CritterProfile = z.infer<typeof critterProfileSchema>;
export type ConventionSettings = z.infer<typeof conventionSettingsSchema>;

// ─── Kanban board ─────────────────────────────────────────────────

export const kanbanColumnSchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string().optional(),
	position: z.number(),
});

export const kanbanLabelSchema = z.object({
	text: z.string(),
	color: z.string().optional(),
});

export const kanbanCardSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	columnId: z.string(),
	position: z.number(),
	labels: z.array(kanbanLabelSchema).optional(),
	assignee: z
		.object({
			name: z.string(),
			avatar: z.string().optional(),
		})
		.optional(),
	department: z
		.object({
			id: z.string(),
			name: z.string(),
			teamId: z.string().optional(),
			teamName: z.string().optional(),
		})
		.optional(),
	collaborators: z
		.array(
			z.object({
				userId: z.string(),
				name: z.string(),
				avatar: z.string().optional(),
			}),
		)
		.optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
	progress: z.number().min(0).max(100).optional(),
	link: z.string().optional(),
	_links: z
		.object({
			update: z.string().optional(),
			delete: z.string().optional(),
			self: z.string().optional(),
		})
		.optional(),
});

export const kanbanDataSchema = z.object({
	columns: z.array(kanbanColumnSchema),
	cards: z.array(kanbanCardSchema),
	_links: z
		.object({
			create: z.string().optional(),
			createForm: formConfigSchema.optional(),
			editForm: formConfigSchema.optional(),
			reorderColumns: z.string().optional(),
			addColumn: z.string().optional(),
		})
		.optional(),
	_meta: z
		.object({
			departmentTeams: z
				.record(
					z.string(),
					z.array(z.object({ id: z.string(), name: z.string() })),
				)
				.optional(),
			departmentMembers: z
				.record(
					z.string(),
					z.array(
						z.object({ id: z.string(), name: z.string(), userId: z.string() }),
					),
				)
				.optional(),
		})
		.optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export const kanbanConfigSchema = z.object({
	title: z.string().optional(),
	emptyState: emptyStateConfigSchema.optional(),
});

export type KanbanColumn = z.infer<typeof kanbanColumnSchema>;
export type KanbanLabel = z.infer<typeof kanbanLabelSchema>;
export type KanbanCard = z.infer<typeof kanbanCardSchema>;
export type KanbanData = z.infer<typeof kanbanDataSchema>;
export type KanbanConfig = z.infer<typeof kanbanConfigSchema>;
