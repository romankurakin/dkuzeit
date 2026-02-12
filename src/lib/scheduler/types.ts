import type { LessonEvent } from '$lib/server/types';
import type { HarmonyColor } from './subject-colors';

export interface SelectItem {
	value: string;
	label: string;
}

export interface CohortGroup {
	label: string;
	value: string;
	items: SelectItem[];
}

export interface SchedulerContext {
	orderedDates: string[];
	groupedEvents: Record<string, LessonEvent[]>;
	subjectColorMap: Map<string, HarmonyColor>;

	groupSelectItems: SelectItem[];
	weekSelectItems: SelectItem[];
	cohortGroups: CohortGroup[];

	selectedGroup: string;
	selectedWeek: string;

	uiLocale: 'ru' | 'de';
	todayIso: string;
	isGeneratingLinks: boolean;
	calendarCopyState: 'idle' | 'pending' | 'success';
	cohortWarningActive: boolean;
	copiedField: 'site' | 'calendar' | null;

	onGroupChange: (value: string) => void;
	onWeekChange: (value: string) => void;
	onCohortChange: (trackLabel: string, code: string) => void;
	onCopySiteLink: () => Promise<void>;
	onCopyCalendarLink: () => Promise<void>;

	formatDateLabel: (dateIso: string) => string;
	eventTitleLabel: (event: LessonEvent) => string;
	isToday: (dateIso: string) => boolean;

	timeSlots: { key: string; start: string; end: string }[];
	getSlotEvents: (date: string, slotKey: string) => LessonEvent[];
}
