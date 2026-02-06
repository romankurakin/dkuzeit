export type CohortTrack = 'de' | 'en' | 'kz' | 'pe' | 'none';
export type UiLanguage = 'ru' | 'de';

export interface WeekOption {
	value: string;
	label: string;
	startDateIso: string;
}

export interface GroupOption {
	id: number;
	codeRaw: string;
	codeRu: string;
	codeDe: string;
}

export interface MetaPayload {
	weeks: WeekOption[];
	groups: GroupOption[];
}

export interface Cohort {
	code: string;
	track: Exclude<CohortTrack, 'none'>;
	label: string;
	sourceGroups: string[];
}

export interface LessonEvent {
	id: string;
	dateIso: string;
	dayIndex: number;
	startTime: string;
	endTime: string;
	subjectShortRaw: string;
	subjectShortRu: string;
	subjectShortDe: string;
	subjectFullRaw: string;
	subjectFullRu: string;
	subjectFullDe: string;
	lessonType: string;
	room: string;
	groupCode: string;
	originGroupCode: string;
	track: CohortTrack;
	cohortCode: string | null;
	scope: 'core_fixed' | 'cohort_shared';
}

export interface GroupWeekSchedule {
	group: GroupOption;
	week: WeekOption;
	events: LessonEvent[];
	cohorts: Cohort[];
}
