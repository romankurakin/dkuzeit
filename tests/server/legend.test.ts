import { describe, expect, it } from 'vitest';
import { makeLegendResolver, parseLegendEntries } from '../../src/lib/server/legend';

describe('legend parse legend entries', () => {
	it('extract code value pairs from legend table', () => {
		const html = `
			<B>Дисциплины</B>
			<TABLE><TR><TD>МАТ1</TD><TD>Математика 1</TD></TR></TABLE>
		`;
		expect(parseLegendEntries(html, 'Дисциплины')).toEqual([
			{ code: 'МАТ1', value: 'Математика 1' }
		]);
	});

	it('skip header rows and nbsp entries', () => {
		const html = `
			<B>Дисциплины</B>
			<TABLE>
				<TR><TD>Имя</TD><TD>Полное назв/имя</TD></TR>
				<TR><TD>&nbsp;</TD><TD>&nbsp;</TD></TR>
				<TR><TD>ФИЗ</TD><TD>Физика</TD></TR>
			</TABLE>
		`;
		const entries = parseLegendEntries(html, 'Дисциплины');
		expect(entries).toEqual([{ code: 'ФИЗ', value: 'Физика' }]);
	});

	it('return empty for missing heading', () => {
		expect(parseLegendEntries('<B>Other</B>', 'Дисциплины')).toEqual([]);
	});
});

describe('legend make legend resolver', () => {
	const entries = [
		{ code: 'МАТ1.л/M1', value: 'Математика 1/Mathematik 1 лекция' },
		{ code: 'ФИЗ', value: 'Физика/Physik' },
		{ code: 'АПЭК.л(D)/ApöK(D)', value: 'Анализ кризиса/ApöK лекция' }
	];
	const resolve = makeLegendResolver(entries);

	it('resolve exact match', () => {
		expect(resolve('ФИЗ')).toBe('Физика/Physik');
	});

	it('resolve case insensitively', () => {
		expect(resolve('физ')).toBe('Физика/Physik');
	});

	it('resolve left prefix fallback before slash', () => {
		expect(resolve('МАТ1.л')).toBe('Математика 1/Mathematik 1 лекция');
	});

	it('resolve source marker variants like code', () => {
		expect(resolve('.*МАТ1.л/')).toBe('Математика 1/Mathematik 1 лекция');
	});

	it('resolve codes without d suffix against legend entries with it', () => {
		expect(resolve('.*АПЭК.л')).toBe('Анализ кризиса/ApöK лекция');
	});

	it('return empty string on miss', () => {
		expect(resolve('UNKNOWN')).toBe('');
	});
});
