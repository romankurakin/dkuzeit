import { describe, expect, it } from 'vitest';
import {
	isMissingGermanName,
	splitBilingualLabel,
	sanitizeLabel
} from '../../src/lib/server/bilingual';

describe('bilingual is missing german name', () => {
	it('return true when kazakh follows slash', () => {
		expect(isMissingGermanName('Казахский язык/Қазақ тілі')).toBe(true);
	});

	it('return false when german follows slash', () => {
		expect(isMissingGermanName('Социология/Soziologie лекция')).toBe(false);
	});

	it('return false when no slash', () => {
		expect(isMissingGermanName('IT Grundlagen')).toBe(false);
	});
});

describe('bilingual split bilingual label', () => {
	it('split ru de with lesson type', () => {
		const result = splitBilingualLabel('Социология/Soziologie лекция', false);
		expect(result.ru).toBe('Социология');
		expect(result.de).toBe('Soziologie');
		expect(result.lessonType).toBe('лекция');
	});

	it('extract known lesson type from no slash label', () => {
		const result = splitBilingualLabel('Физкультура пр.', false);
		expect(result.ru).toBe('Физкультура');
		expect(result.de).toBe('Физкультура');
		expect(result.lessonType).toBe('пр.');
	});

	it('fall back to ru when no german is true', () => {
		const result = splitBilingualLabel('Казахский язык/Қазақ тілі пр.', true);
		expect(result.ru).toBe('Казахский язык');
		expect(result.de).toBe('Казахский язык');
	});

	it('handle no slash case without lesson type', () => {
		const result = splitBilingualLabel('IT Grundlagen', false);
		expect(result.ru).toBe('IT Grundlagen');
		expect(result.de).toBe('IT Grundlagen');
		expect(result.lessonType).toBe('');
	});

	it('strip leading dots and asterisks', () => {
		const result = splitBilingualLabel('..МАТ/Math лек.', false);
		expect(result.ru).toBe('МАТ');
		expect(result.de).toBe('Math');
	});
});

describe('bilingual sanitize label', () => {
	it('strip trailing slash', () => {
		expect(sanitizeLabel('ВМ2.л/')).toBe('ВМ2.л');
	});

	it('strip leading dashes', () => {
		expect(sanitizeLabel('--test')).toBe('test');
	});

	it('trim whitespace', () => {
		expect(sanitizeLabel('  hello  ')).toBe('hello');
	});
});
