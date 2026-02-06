import type { CohortTrack } from './types';

export interface TrackRule {
	track: Exclude<CohortTrack, 'none'>;
	namePattern: RegExp;
}

export interface CohortCodeRule {
	track: Exclude<CohortTrack, 'none'>;
	codePattern: RegExp;
	code: string;
}

export const trackRules: TrackRule[] = [
	{ track: 'kz', namePattern: /Бизнес қазақ тілі/i },
	{ track: 'kz', namePattern: /Казахский язык/i },
	{ track: 'de', namePattern: /Немецкий язык/i },
	{ track: 'en', namePattern: /Английский язык/i },
	{ track: 'en', namePattern: /Business and Soft Skills/i },
	{ track: 'pe', namePattern: /Физическая культура.*девушк/i },
	{ track: 'pe', namePattern: /Физическая культура.*юнош/i },
];

export const cohortCodeRules: CohortCodeRule[] = [
	{ track: 'de', codePattern: /^D0?(\d{1,2})$/i, code: 'D$1' },
	{ track: 'en', codePattern: /^E0?(\d{1,2})$/i, code: 'E$1' },
	{ track: 'kz', codePattern: /^Каз\.?(\d+)\/Б/i, code: 'Каз.$1/Б' },
	{ track: 'kz', codePattern: /^Каз\.?(\d+)/i, code: 'Каз.$1' },
	{ track: 'en', codePattern: /^BSг\.?(\d+)/i, code: 'BS$1' },
	{ track: 'pe', codePattern: /^ФК\(д\)/i, code: 'ФК(д)' },
	{ track: 'pe', codePattern: /^ФК\(ю\)/i, code: 'ФК(ю)' },
];

export const genericCodes = new Set(['DE', 'EN', 'KAZ', 'KAZ-B']);
