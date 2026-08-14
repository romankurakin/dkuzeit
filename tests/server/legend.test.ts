import { describe, expect, it } from 'vitest';
import { parseDocument } from 'htmlparser2';
import { makeLegendResolver, parseLegendEntries } from '../../src/lib/server/legend';

describe('parseLegendEntries', () => {
	it('extracts code-value pairs from legend table', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<table><tr><td>МАТ1</td><td>Математика 1</td></tr></table>
		</body></html>`;
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([
			{ code: 'МАТ1', value: 'Математика 1' }
		]);
	});

	it('skips header rows and nbsp entries', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<table>
				<tr><td>Имя</td><td>Полное назв/имя</td></tr>
				<tr><td>&nbsp;</td><td>&nbsp;</td></tr>
				<tr><td>ФИЗ</td><td>Физика</td></tr>
			</table>
		</body></html>`;
		const entries = parseLegendEntries(parseDocument(html), 'Дисциплины');
		expect(entries).toEqual([{ code: 'ФИЗ', value: 'Физика' }]);
	});

	it('returns empty for missing heading', () => {
		const html = '<html><body><b>Other</b></body></html>';
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([]);
	});

	it('returns empty when bold found but no table follows', () => {
		const html = '<html><body><b>Дисциплины</b><p>no table here</p></body></html>';
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([]);
	});

	it('handles empty bold element', () => {
		const html =
			'<html><body><b></b><b>Дисциплины</b><table><tr><td>A</td><td>B</td></tr></table></body></html>';
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([
			{ code: 'A', value: 'B' }
		]);
	});

	it('handles empty td cells', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<table><tr><td></td><td></td></tr><tr><td>X</td><td>Y</td></tr></table>
		</body></html>`;
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([
			{ code: 'X', value: 'Y' }
		]);
	});

	it('extracts from table with thead and tbody sections', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<table>
				<thead><tr><td>Имя</td><td>Полное назв/имя</td></tr></thead>
				<tbody>
					<tr><td>ФИЗ</td><td>Физика</td></tr>
					<tr><td>ХИМ</td><td>Химия</td></tr>
				</tbody>
			</table>
		</body></html>`;
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([
			{ code: 'ФИЗ', value: 'Физика' },
			{ code: 'ХИМ', value: 'Химия' }
		]);
	});

	it('finds table after bold when other elements are in between', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<br>
			<div><p>Some text</p></div>
			<table><tr><td>АЛГ</td><td>Алгебра</td></tr></table>
		</body></html>`;
		expect(parseLegendEntries(parseDocument(html), 'Дисциплины')).toEqual([
			{ code: 'АЛГ', value: 'Алгебра' }
		]);
	});
});

describe('makeLegendResolver', () => {
	const entries = [
		{ code: 'МАТ1.л/M1', value: 'Математика 1/Mathematik 1 лекция' },
		{ code: 'ФИЗ', value: 'Физика/Physik' },
		{ code: 'АПЭК.л(D)/ApöK(D)', value: 'Анализ кризиса/ApöK лекция' }
	];
	const resolve = makeLegendResolver(entries);

	it('resolves exact match', () => {
		expect(resolve('ФИЗ')).toBe('Физика/Physik');
	});

	it('resolves case-insensitively', () => {
		expect(resolve('физ')).toBe('Физика/Physik');
	});

	it('resolves left prefix fallback before slash', () => {
		expect(resolve('МАТ1.л')).toBe('Математика 1/Mathematik 1 лекция');
	});

	it('resolves source marker variants like code', () => {
		expect(resolve('.*МАТ1.л/')).toBe('Математика 1/Mathematik 1 лекция');
	});

	it('resolves codes without d suffix against legend entries with it', () => {
		expect(resolve('.*АПЭК.л')).toBe('Анализ кризиса/ApöK лекция');
	});

	it('returns empty string on miss', () => {
		expect(resolve('UNKNOWN')).toBe('');
	});

	it('resolves truncated cell codes by unique legend prefix', () => {
		const truncated = makeLegendResolver([
			{ code: 'ННРТПР.л/WA', value: 'Научные направления/WA лекция' },
			{ code: 'ФИЗ', value: 'Физика/Physik' }
		]);
		expect(truncated('ННРТПР')).toBe('Научные направления/WA лекция');
	});

	it('resolves prefix when all matching entries share one full name', () => {
		const shared = makeLegendResolver([
			{ code: 'TestDaF/TestAs', value: 'TestDaF' },
			{ code: 'TestDaF/TestAs', value: 'TestDaF' }
		]);
		expect(shared('TestDa')).toBe('TestDaF');
	});

	it('keeps prefix matches unresolved when full names disagree', () => {
		const ambiguous = makeLegendResolver([
			{ code: 'СПУРП2.л/ERP2', value: 'Система планирования/ERP2 лекция' },
			{ code: 'СПУРП2.с/ERP2', value: 'Система планирования/ERP2 семинар' }
		]);
		expect(ambiguous('СПУРП2')).toBe('');
		expect(ambiguous('СПУРП2.л')).toBe('Система планирования/ERP2 лекция');
	});

	it('never prefix-matches single-character codes', () => {
		const single = makeLegendResolver([{ code: 'ФИЗ', value: 'Физика/Physik' }]);
		expect(single('Ф')).toBe('');
	});
});
