import { describe, expect, it } from 'vitest';
import { parseDocument } from 'htmlparser2';
import { hasEvents, parseNavHtml } from '../../src/lib/server/parser';

describe('parseNavHtml', () => {
	it('skips non-date week options from navbar', () => {
		const html = `
		<html>
			<body>
				<select name="week">
					<option value="10">2.3.2026</option>
					<option value="1">____________________</option>
				</select>
				<script>
					var classes = ["1-CS"];
				</script>
			</body>
		</html>
		`;

		const parsed = parseNavHtml(parseDocument(html));
		expect(parsed.weeks).toEqual([
			{
				value: '10',
				label: '2.3.2026',
				startDateIso: '2026-03-02'
			}
		]);
	});

	it('throws when select exists but name is not week', () => {
		const html = `
		<html><body>
			<select name="other"><option value="1">x</option></select>
		</body></html>`;
		expect(() => parseNavHtml(parseDocument(html))).toThrow('Week select not found in navbar');
	});

	it('keeps parenthesized suffix when stripped labels would collide', () => {
		const html = `
		<html>
			<body>
				<select name="week">
					<option value="10">2.3.2026</option>
				</select>
				<script>
					var classes = ["2-Мен(МА)/2-Man(MA)", "2-Мен/Man"];
				</script>
			</body>
		</html>
		`;

		const parsed = parseNavHtml(parseDocument(html));
		expect(parsed.groups).toEqual([
			{
				id: 1,
				codeRaw: '2-Мен(МА)/2-Man(MA)',
				codeRu: '2-Мен(МА)',
				codeDe: '2-Man(MA)'
			},
			{
				id: 2,
				codeRaw: '2-Мен/Man',
				codeRu: '2-Мен',
				codeDe: '2-Man'
			}
		]);
	});
});

describe('hasEvents', () => {
	it('returns true when legend has disciplines', () => {
		const html = `<html><body>
			<b>Дисциплины</b>
			<table><tr><td>МАТ</td><td>Математика</td></tr></table>
		</body></html>`;
		expect(hasEvents(parseDocument(html))).toBe(true);
	});

	it('returns false when no disciplines legend', () => {
		const html = '<html><body><p>empty</p></body></html>';
		expect(hasEvents(parseDocument(html))).toBe(false);
	});
});
