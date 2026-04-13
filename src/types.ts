/**
 * Canonical type definitions for ConvStack service manifests.
 *
 * All types are inferred from the Zod schemas in `./manifest-schema.ts` —
 * editing that file is the only way to change the manifest contract.
 *
 * This re-export exists for backwards compatibility with existing imports
 * (`import { UIManifest, PageSection, … } from "@convstack/service-sdk/types"`)
 * and to keep the public type surface stable while the schema location moves.
 */

export type {
	AgendaConfig,
	ApprovalQueueConfig,
	ApprovalQueueData,
	ApprovalQueueItem,
	BadgeValue,
	CalendarDayConfig,
	CalendarGridConfig,
	CalendarMonthConfig,
	CalloutConfig,
	CardsConfig,
	ConventionSettings,
	CritterProfile,
	DataTableColumn,
	DataTableConfig,
	DetailConfig,
	DetailField,
	DetailGroup,
	EmptyStateAction,
	EmptyStateConfig,
	FormConfig,
	HeroAction,
	HeroConfig,
	JsonValue,
	KanbanCard,
	KanbanColumn,
	KanbanConfig,
	KanbanData,
	KanbanLabel,
	NavigationItem,
	PageDefinition,
	PageSection,
	RowAction,
	ScheduleData,
	ScheduleEvent,
	ScheduleEventLinks,
	SchedulePresenter,
	ScheduleTrack,
	ServiceSidebar,
	StatsRowConfig,
	TabDefinition,
	TabsConfig,
	TimelineConfig,
	TopBarContribution,
	UIManifest,
	UpcomingStripConfig,
	WidgetDefinition,
} from "./manifest-schema";
