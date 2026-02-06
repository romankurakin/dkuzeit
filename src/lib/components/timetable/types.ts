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

export interface Cohort {
	code: string;
	track: 'de' | 'en' | 'kz' | 'pe';
	label: string;
	sourceGroups: string[];
}

export interface LessonEvent {
	id: string;
	dateIso: string;
	startTime: string;
	endTime: string;
	subjectShortRu: string;
	subjectShortDe: string;
	subjectFullRu: string;
	subjectFullDe: string;
	lessonType: string;
	room: string;
	originGroupCode: string;
	cohortCode: string | null;
	scope: 'core_fixed' | 'cohort_shared';
}
