import type {
	ApprovalQueueData,
	ApprovalQueueItem,
	EmptyStateConfig,
	FormConfig,
	ScheduleData,
	ScheduleEvent,
	ScheduleTrack,
} from "../types";

export function scheduleData(
	events: ScheduleEvent[],
	options: {
		tracks?: ScheduleTrack[];
		links?: {
			create?: string;
			createForm?: FormConfig;
			editForm?: FormConfig;
		};
		emptyState?: EmptyStateConfig;
	} = {},
): ScheduleData {
	return {
		events,
		tracks: options.tracks,
		_links: options.links,
		emptyState: options.emptyState,
	};
}

export function approvalQueueData(
	items: ApprovalQueueItem[],
	options: { emptyState?: EmptyStateConfig } = {},
): ApprovalQueueData {
	return {
		items,
		total: items.length,
		emptyState: options.emptyState,
	};
}

/** Generic pass-through for custom shapes that don't have a named builder. */
export function ok<T>(data: T): T {
	return data;
}
