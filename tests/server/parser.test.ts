import { describe, expect, it } from 'vitest';
import { parseNavHtml } from '../../src/lib/server/parser';

describe('parseNavHtml', () => {
	it('skip non-date week options from navbar', () => {
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

		const parsed = parseNavHtml(html);
		expect(parsed.weeks).toEqual([
			{
				value: '10',
				label: '2.3.2026',
				startDateIso: '2026-03-02'
			}
		]);
	});

	it('keep parenthesized suffix when stripped labels would collide', () => {
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

		const parsed = parseNavHtml(html);
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
