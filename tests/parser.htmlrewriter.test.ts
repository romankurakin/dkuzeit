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

	it('splits a double-period cell (rowspan=4) into two separate events', async () => {
		// Each period occupies 2 table rows (time cell rowspan=2),
		// so a double-period event has rowspan=4 on the content cell
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="4">
						<table>
							<tr><td>Мат2.л</td></tr>
							<tr><td>Жнб/Zh</td></tr>
							<tr><td>17а</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
				<tr>
					<td rowspan="2">09:50 - 11:30</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>Мат2.л</td><td>Математика 2/Mathematik 2 лекция</td></tr>`
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(2);

		const [first, second] = parsed.events;
		// Both events share the same subject
		expect(first!.subjectShortRaw).toBe('Мат2.л');
		expect(second!.subjectShortRaw).toBe('Мат2.л');
		// First event covers period 1
		expect(first!.startTime).toBe('08:00');
		expect(first!.endTime).toBe('09:40');
		// Second event covers period 2
		expect(second!.startTime).toBe('09:50');
		expect(second!.endTime).toBe('11:30');
		// Same room for both
		expect(first!.room).toBe('17а');
		expect(second!.room).toBe('17а');
		// Different IDs
		expect(first!.id).not.toBe(second!.id);
	});

	it('single-period cell (rowspan=2) still produces one event', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>PHYS</td></tr>
							<tr><td>Doc/Dc</td></tr>
							<tr><td>301</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>PHYS</td><td>Физика/Physik лекция</td></tr>`
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.startTime).toBe('08:00');
		expect(parsed.events[0]!.endTime).toBe('09:40');
	});

	it('skips day-range marker cells like 09.03.2026-09.03.2026', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">09.03.2026-09.03.2026</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(0);
	});

	it('deduplicates identical event seeds emitted from split columns of one day', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="4" rowspan="2">DUP</td>
					<td colspan="4" rowspan="2">DUP</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>DUP</td><td>Дублирование/Duplizierung лекция</td></tr>`
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.subjectShortRaw).toBe('DUP');
		expect(parsed.events[0]!.startTime).toBe('08:00');
		expect(parsed.events[0]!.endTime).toBe('09:40');
		expect(parsed.events[0]!.dayIndex).toBe(0);
	});

	it('skips unknown placeholder subject "?" when legend has no mapping', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">?</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(0);
	});

	it('falls back to cleaned short label when full legend name is missing', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">.*СПУРП2</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(html, group, week);
		expect(parsed.events).toHaveLength(1);
		const event = parsed.events[0]!;
		expect(event.subjectShortRu).toBe('СПУРП2');
		expect(event.subjectFullRu).toBe('СПУРП2');
		expect(event.subjectFullDe).toBe('СПУРП2');
		expect(event.subjectFullRaw).toBe('СПУРП2');
	});

	it('throws a clear error when center container is absent', async () => {
		await expect(
			parseTimetablePage('<html><body><table></table></body></html>', group, week)
		).rejects.toThrow('Timetable center container not found');
	});
});
