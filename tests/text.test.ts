import { describe, expect, it } from 'vitest';
import {
	cleanText,
	russianOnlyLabel,
	germanOnlyLabel,
	extractLessonType,
	stripParenSuffix,
	normalizeCodeKey,
	leftSideCode
} from '../src/lib/server/text';

describe('cleanText', () => {
	it('strips HTML tags and decodes entities', () => {
		expect(cleanText('<b>Hello&nbsp;world</b>')).toBe('Hello world');
	});

	it('collapses whitespace', () => {
		expect(cleanText('  foo   bar  ')).toBe('foo bar');
	});
});

describe('russianOnlyLabel', () => {
	it('returns text before the first slash', () => {
		expect(russianOnlyLabel('Социология/Soziologie лекция/семинар')).toBe('Социология');
	});

	it('returns full text when no slash', () => {
		expect(russianOnlyLabel('IT Grundlagen')).toBe('IT Grundlagen');
	});

	it('strips leading dots', () => {
		expect(russianOnlyLabel('.ЭкТ.л/')).toBe('ЭкТ.л');
	});

	it('handles empty right side', () => {
		expect(russianOnlyLabel('ВМ2.л/')).toBe('ВМ2.л');
	});
});

describe('germanOnlyLabel', () => {
	it('returns German part of a bilingual name', () => {
		expect(germanOnlyLabel('Социология/Soziologie лекция/семинар')).toBe('Soziologie');
	});

	it('strips Cyrillic lesson type suffix', () => {
		expect(germanOnlyLabel('Немецкий язык/Deutsch пр.')).toBe('Deutsch');
	});

	it('returns full text when no slash', () => {
		expect(germanOnlyLabel('IT Grundlagen')).toBe('IT Grundlagen');
	});

	it('handles empty right side (trailing slash)', () => {
		expect(germanOnlyLabel('ВМ2.л/')).toBe('ВМ2.л/');
	});

	it('handles single letter German abbreviation', () => {
		expect(germanOnlyLabel('КП.л/K')).toBe('K');
	});

	it('handles Kazakh after slash (all Cyrillic)', () => {
		expect(germanOnlyLabel('Казахский язык/Бизнес қазақ тілі')).toBe('Бизнес');
	});
});

describe('extractLessonType', () => {
	it('extracts single lesson type', () => {
		expect(extractLessonType('Экономическая теория/Wirtschaftstheorie лекция')).toBe('лекция');
	});

	it('extracts compound lesson type with slash', () => {
		expect(extractLessonType('Социология/Soziologie лекция/семинар')).toBe('лекция/семинар');
	});

	it('extracts short lesson type', () => {
		expect(extractLessonType('Казахский язык/Kasachisch пр.')).toBe('пр.');
	});

	it('returns empty for no slash', () => {
		expect(extractLessonType('IT Grundlagen')).toBe('');
	});

	it('returns empty when no Cyrillic suffix after German name', () => {
		expect(extractLessonType('Логистика/Logistik')).toBe('');
	});

	it('extracts known lesson type from no-slash entry', () => {
		expect(extractLessonType('Business  and Soft Skills БД(B2.1-C1) гр.2 пр.')).toBe('пр.');
	});
});

describe('stripParenSuffix', () => {
	it('removes parenthesized suffix', () => {
		expect(stripParenSuffix('1-IM-IBE/IBE гр.1(MA)')).toBe('1-IM-IBE/IBE гр.1');
	});

	it('leaves text without parens unchanged', () => {
		expect(stripParenSuffix('3А-ТЛ')).toBe('3А-ТЛ');
	});
});

describe('normalizeCodeKey', () => {
	it('uppercases and strips dots and trailing slash', () => {
		expect(normalizeCodeKey('.экт.л/')).toBe('ЭКТ.Л');
	});
});

describe('leftSideCode', () => {
	it('extracts normalized left side of a slash-separated code', () => {
		expect(leftSideCode('.ЭкТ.л/W')).toBe('ЭКТ.Л');
	});
});
