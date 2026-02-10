import { describe, expect, it } from 'vitest';
import { parseTimetablePage } from '../src/lib/server/parser';
import type { GroupOption, WeekOption } from '../src/lib/server/types';

const group: GroupOption = {
	id: 1,
	codeRaw: 'T-GROUP',
	codeRu: 'T-GROUP',
	codeDe: 'T-GROUP'
};

const week: WeekOption = {
	value: '01',
	label: '01.09.2026 - 07.09.2026',
	startDateIso: '2026-09-01'
};

function wrapTimetable(innerTableRows: string, legendRows: string): string {
	return `
		<html>
			<body>
				<center>
					<table>
						<tbody>
							${innerTableRows}
						</tbody>
					</table>
				</center>
				<B>Пн 01.09.</B>
				<B>Вт 02.09.</B>
				<B>Ср 03.09.</B>
				<B>Чт 04.09.</B>
				<B>Пт 05.09.</B>
				<B>Сб 06.09.</B>
				<B>Дисциплины</B>
				<TABLE>
					${legendRows}
				</TABLE>
			</body>
		</html>
	`;
}

describe('parseTimetablePage HTMLRewriter state machine', () => {
	it('extracts only first-level nested table lines from a schedule cell', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td>08:00 - 08:50</td>
					<td colspan="12">
						<table>
							<tr><td>MATH</td></tr>
							<tr>
								<td>
									Teacher
									<table><tr><td>INNER_NOISE</td></tr></table>
								</td>
							</tr>
							<tr><td>A101</td></tr>
						</table>
					</td>
				</tr>
			`,
			`<tr><td>MATH</td><td>Математика/Mathematik лекция</td></tr>`
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.subjectShortRaw).toBe('MATH');
		expect(event.subjectFullRaw).toBe('Математика/Mathematik лекция');
		expect(event.room).toBe('A101');
		expect(event.startTime).toBe('08:00');
		expect(event.endTime).toBe('08:50');
		expect(event.dayIndex).toBe(0);
	});

	it('supports rowspan timing and fallback text extraction without nested table', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:30</td>
					<td colspan="12" rowspan="2">
						ENG
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>ENG</td><td>Английский/Englisch лекция</td></tr>`
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.subjectShortRaw).toBe('ENG');
		expect(event.startTime).toBe('08:00');
		expect(event.endTime).toBe('09:30');
		expect(event.room).toBe('');
		expect(event.dayIndex).toBe(0);
	});

	it('throws a clear error when center container is absent', async () => {
		await expect(
			parseTimetablePage('<html><body><table></table></body></html>', group, week)
		).rejects.toThrow('Timetable center container not found');
	});
});
