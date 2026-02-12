import { describe, expect, it } from 'vitest';
import {
	cleanText,
	russianOnlyLabel,
	germanOnlyLabel,
	stripParenSuffix
} from '../../src/lib/server/text';

describe('text clean text', () => {
	it('strip html tags and decode entities', () => {
		expect(cleanText('<b>Hello&nbsp;world</b>')).toBe('Hello world');
	});

	it('collapse whitespace', () => {
		expect(cleanText('  foo   bar  ')).toBe('foo bar');
	});
});

describe('text russian only label', () => {
	it('return text before the first slash', () => {
		expect(russianOnlyLabel('Социология/Soziologie лекция/семинар')).toBe('Социология');
	});

	it('return full text when no slash', () => {
		expect(russianOnlyLabel('IT Grundlagen')).toBe('IT Grundlagen');
	});

	it('strip leading dots', () => {
		expect(russianOnlyLabel('.ЭкТ.л/')).toBe('ЭкТ.л');
	});

	it('handle empty right side', () => {
		expect(russianOnlyLabel('ВМ2.л/')).toBe('ВМ2.л');
	});
});

describe('text german only label', () => {
	it('return german part of a bilingual name', () => {
		expect(germanOnlyLabel('Социология/Soziologie лекция/семинар')).toBe('Soziologie');
	});

	it('strip cyrillic lesson type suffix', () => {
		expect(germanOnlyLabel('Немецкий язык/Deutsch пр.')).toBe('Deutsch');
	});

	it('return full text when no slash', () => {
		expect(germanOnlyLabel('IT Grundlagen')).toBe('IT Grundlagen');
	});

	it('handle empty right side trailing slash', () => {
		expect(germanOnlyLabel('ВМ2.л/')).toBe('ВМ2.л/');
	});

	it('handle single letter german abbreviation', () => {
		expect(germanOnlyLabel('КП.л/K')).toBe('K');
	});

	it('handle kazakh after slash all cyrillic', () => {
		expect(germanOnlyLabel('Казахский язык/Бизнес қазақ тілі')).toBe('Бизнес');
	});
});

describe('text strip paren suffix', () => {
	it('remove parenthesized suffix', () => {
		expect(stripParenSuffix('1-IM-IBE/IBE гр.1(MA)')).toBe('1-IM-IBE/IBE гр.1');
	});

	it('leave text without parens unchanged', () => {
		expect(stripParenSuffix('3А-ТЛ')).toBe('3А-ТЛ');
	});
});
