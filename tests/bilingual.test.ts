import { describe, expect, it } from 'vitest';
import {
	isMissingGermanName,
	splitBilingualLabel,
	sanitizeLabel
} from '../src/lib/server/bilingual';

describe('isMissingGermanName', () => {
	it('returns true when Kazakh follows slash', () => {
		expect(isMissingGermanName('Казахский язык/Қазақ тілі')).toBe(true);
	});

	it('returns false when German follows slash', () => {
		expect(isMissingGermanName('Социология/Soziologie лекция')).toBe(false);
	});

	it('returns false when no slash', () => {
		expect(isMissingGermanName('IT Grundlagen')).toBe(false);
	});
});

describe('splitBilingualLabel', () => {
	it('splits ru/de with lesson type', () => {
		const result = splitBilingualLabel('Социология/Soziologie лекция', false);
		expect(result.ru).toBe('Социология');
		expect(result.de).toBe('Soziologie');
		expect(result.lessonType).toBe('лекция');
	});

	it('extracts known lesson type from no-slash label', () => {
		const result = splitBilingualLabel('Физкультура пр.', false);
		expect(result.ru).toBe('Физкультура');
		expect(result.de).toBe('Физкультура');
		expect(result.lessonType).toBe('пр.');
	});

	it('falls back to ru when noGerman is true', () => {
		const result = splitBilingualLabel('Казахский язык/Қазақ тілі пр.', true);
		expect(result.ru).toBe('Казахский язык');
		expect(result.de).toBe('Казахский язык');
	});

	it('handles no-slash case without lesson type', () => {
		const result = splitBilingualLabel('IT Grundlagen', false);
		expect(result.ru).toBe('IT Grundlagen');
		expect(result.de).toBe('IT Grundlagen');
		expect(result.lessonType).toBe('');
	});

	it('strips leading dots and asterisks', () => {
		const result = splitBilingualLabel('..МАТ/Math лек.', false);
		expect(result.ru).toBe('МАТ');
		expect(result.de).toBe('Math');
	});
});

describe('sanitizeLabel', () => {
	it('strips trailing slash', () => {
		expect(sanitizeLabel('ВМ2.л/')).toBe('ВМ2.л');
	});

	it('strips leading dashes', () => {
		expect(sanitizeLabel('--test')).toBe('test');
	});

	it('trims whitespace', () => {
		expect(sanitizeLabel('  hello  ')).toBe('hello');
	});
});
