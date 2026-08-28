import { describe, expect, it } from 'vitest';
import { parseDocument } from 'htmlparser2';
import { parseTimetablePage } from '../../src/lib/server/parser';
import type { GroupOption, WeekOption } from '../../src/lib/server/types';

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
				<b>Пн 01.09.</b>
				<b>Вт 02.09.</b>
				<b>Ср 03.09.</b>
				<b>Чт 04.09.</b>
				<b>Пт 05.09.</b>
				<b>Сб 06.09.</b>
				<b>Дисциплины</b>
				<table>
					${legendRows}
				</table>
			</body>
		</html>
	`;
}

describe('parseTimetablePage', () => {
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.subjectShortRaw).toBe('ENG');
		expect(event.startTime).toBe('08:00');
		expect(event.endTime).toBe('09:30');
		expect(event.room).toBe('');
		expect(event.dayIndex).toBe(0);
	});

	it('splits a double period cell rowspan 4 into two separate events', async () => {
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
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

	it('produces one event for single period cell rowspan 2', async () => {
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.startTime).toBe('08:00');
		expect(parsed.events[0]!.endTime).toBe('09:40');
	});

	it('skips day range marker cells', async () => {
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.subjectShortRaw).toBe('DUP');
		expect(parsed.events[0]!.startTime).toBe('08:00');
		expect(parsed.events[0]!.endTime).toBe('09:40');
		expect(parsed.events[0]!.dayIndex).toBe(0);
	});

	it('skips unknown placeholder subject when legend has no mapping', async () => {
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
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

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		const event = parsed.events[0]!;
		expect(event.subjectShortRu).toBe('СПУРП2');
		expect(event.subjectFullRu).toBe('СПУРП2');
		expect(event.subjectFullDe).toBe('СПУРП2');
		expect(event.subjectFullRaw).toBe('СПУРП2');
	});

	it('throws a clear error when center container is absent', () => {
		expect(() =>
			parseTimetablePage(parseDocument('<html><body><table></table></body></html>'), group, week)
		).toThrow('Main timetable table not found');
	});

	it('emits both lessons from a cell stacking two different subjects', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.D4</td></tr>
							<tr><td>Тлг/Tl</td></tr>
							<tr><td>502</td></tr>
							<tr><td>D2</td></tr>
							<tr><td>Хсн/Kh</td></tr>
							<tr><td>503</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(2);

		const d4 = parsed.events.find((event) => event.subjectShortRaw === '.D4');
		const d2 = parsed.events.find((event) => event.subjectShortRaw === 'D2');
		expect(d4?.room).toBe('502');
		expect(d4?.cohortCode).toBe('D4');
		expect(d2?.room).toBe('503');
		expect(d2?.cohortCode).toBe('D2');
	});

	it('collapses stacked same-subject same-room lessons into one event', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.*Анг.э/</td></tr>
							<tr><td>Нрж/Nr</td></tr>
							<tr><td>502</td></tr>
							<tr><td>*Анг.э/</td></tr>
							<tr><td>Млк/Mk</td></tr>
							<tr><td>502</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.room).toBe('502');
	});

	it('keeps stacked same-subject lessons in different rooms as separate events', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.Каз.э/</td></tr>
							<tr><td>Агн/Ag</td></tr>
							<tr><td>401</td></tr>
							<tr><td>Каз.э/</td></tr>
							<tr><td>Слт/Cl</td></tr>
							<tr><td>509</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(2);
		expect(parsed.events.map((event) => event.room).sort()).toEqual(['401', '509']);
	});

	it('ignores an incomplete trailing triple in a stacked cell', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>Grb</td></tr>
							<tr><td>309</td></tr>
							<tr><td>Grb</td></tr>
							<tr><td>304</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.subjectShortRaw).toBe('Grb');
	});

	it('extracts cohort code from star-prefixed subject codes', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">*D5</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		expect(parsed.events[0]!.cohortCode).toBe('D5');
	});

	it('dates events from the week start when day headers are missing', async () => {
		const html = `
			<html>
				<body>
					<center>
						<table>
							<tbody>
								<tr>
									<td rowspan="2">08:00 - 09:40</td>
									<td colspan="12" rowspan="2">MATH</td>
								</tr>
								<tr></tr>
							</tbody>
						</table>
					</center>
				</body>
			</html>
		`;

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);
		// week.startDateIso is 2026-09-01; the +05:00/UTC mixup used to yield 2026-08-31
		expect(parsed.events[0]!.dateIso).toBe('2026-09-01');
	});

	it('dates January days of a New Year week with the next year', async () => {
		const newYearWeek: WeekOption = {
			value: '52',
			label: '28.12.2026',
			startDateIso: '2026-12-28'
		};
		const html = `
			<html>
				<body>
					<center>
						<table>
							<tbody>
								<tr>
									<td rowspan="2">08:00 - 09:40</td>
									<td colspan="12" rowspan="2">MON</td>
									<td colspan="36" rowspan="2"></td>
									<td colspan="12" rowspan="2">FRI</td>
								</tr>
								<tr></tr>
							</tbody>
						</table>
					</center>
					<b>Пн 28.12.</b>
					<b>Вт 29.12.</b>
					<b>Ср 30.12.</b>
					<b>Чт 31.12.</b>
					<b>Пт 1.1.</b>
					<b>Сб 2.1.</b>
				</body>
			</html>
		`;

		const parsed = await parseTimetablePage(parseDocument(html), group, newYearWeek);
		expect(parsed.events).toHaveLength(2);
		const monday = parsed.events.find((event) => event.subjectShortRaw === 'MON');
		const friday = parsed.events.find((event) => event.subjectShortRaw === 'FRI');
		expect(monday?.dateIso).toBe('2026-12-28');
		expect(friday?.dateIso).toBe('2027-01-01');
	});

	it('keeps language subgroup codes with leading zero distinct from plain numbers', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">D01</td>
				</tr>
				<tr></tr>
				<tr>
					<td rowspan="2">09:50 - 11:30</td>
					<td colspan="12" rowspan="2">D1</td>
				</tr>
				<tr></tr>
				<tr>
					<td rowspan="2">11:40 - 13:20</td>
					<td colspan="12" rowspan="2">E01</td>
				</tr>
				<tr></tr>
				<tr>
					<td rowspan="2">13:30 - 15:10</td>
					<td colspan="12" rowspan="2">E1</td>
				</tr>
				<tr></tr>
			`,
			``
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);

		expect(parsed.events.map((event) => event.cohortCode)).toEqual(['D01', 'D1', 'E01', 'E1']);
		expect(parsed.cohorts.map((cohort) => cohort.code)).toEqual(['D01', 'D1', 'E01', 'E1']);
	});

	it('takes exam lesson type and bilingual names from a legend entry', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.ЭкТ.э</td></tr>
							<tr><td>Тн/Tn</td></tr>
							<tr><td>21</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>ЭкТ.э/W</td><td>Экономическая теория/Wirtschaftstheorie экзамен</td></tr>`
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.lessonType).toBe('экзамен');
		expect(event.subjectFullRu).toBe('Экономическая теория');
		expect(event.subjectFullDe).toBe('Wirtschaftstheorie');
	});

	it('keeps generic Kazakh entries out of cohort filters', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.Каз.э</td></tr>
							<tr><td>Тн/Tn</td></tr>
							<tr><td>21</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>Каз.э/Kas</td><td>Казахский язык/Kasachisch экзамен</td></tr>`
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.track).toBe('kz');
		expect(event.cohortCode).toBeNull();
		expect(event.scope).toBe('core_fixed');
		expect(event.lessonType).toBe('экзамен');
		expect(event.subjectFullDe).toBe('Kasachisch');
		expect(parsed.cohorts).toEqual([]);
	});

	it('extracts lesson type from a legend entry without a slash', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.BSг.э</td></tr>
							<tr><td>Нрж/Nr</td></tr>
							<tr><td>502</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>BSг.э</td><td>Business  and Soft Skills БД(B2.1-C1)  экзамен</td></tr>`
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.lessonType).toBe('экзамен');
		expect(event.subjectFullRu).toBe('Business and Soft Skills БД(B2.1-C1)');
		expect(event.subjectFullRu).not.toContain('экзамен');
	});

	it('files specialised English under the English cohort track', async () => {
		const html = wrapTimetable(
			`
				<tr>
					<td rowspan="2">08:00 - 09:40</td>
					<td colspan="12" rowspan="2">
						<table>
							<tr><td>.Анг.сп</td></tr>
							<tr><td>Ткб/To</td></tr>
							<tr><td>509</td></tr>
						</table>
					</td>
				</tr>
				<tr></tr>
			`,
			`<tr><td>Анг.спец1/FEng</td><td>Английский язык/Fachsprache Englisch гр1 пр.</td></tr>
			 <tr><td>Анг.спец.2/FEng</td><td>Английский язык/Fachsprache Englisch гр2 пр.</td></tr>`
		);

		const parsed = await parseTimetablePage(parseDocument(html), group, week);
		expect(parsed.events).toHaveLength(1);

		const event = parsed.events[0]!;
		expect(event.track).toBe('en');
		expect(event.cohortCode).toBe('Анг.сп');
		expect(event.scope).toBe('cohort_shared');
		// The cell code is truncated past the subgroup digit, so the shared subject
		// name survives and the disagreeing suffix does not
		expect(event.subjectFullRu).toBe('Английский язык');
		expect(event.subjectFullDe).toBe('Fachsprache Englisch');
		expect(parsed.cohorts).toEqual([
			{ code: 'Анг.сп', track: 'en', label: 'Английский язык', sourceGroups: ['T-GROUP'] }
		]);
	});
});
