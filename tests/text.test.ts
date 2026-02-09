import { describe, expect, it } from 'vitest';
import {
	cleanText,
	russianOnlyLabel,
	germanOnlyLabel,
	stripParenSuffix
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

describe('stripParenSuffix', () => {
	it('removes parenthesized suffix', () => {
		expect(stripParenSuffix('1-IM-IBE/IBE гр.1(MA)')).toBe('1-IM-IBE/IBE гр.1');
	});

	it('leaves text without parens unchanged', () => {
		expect(stripParenSuffix('3А-ТЛ')).toBe('3А-ТЛ');
	});
});
