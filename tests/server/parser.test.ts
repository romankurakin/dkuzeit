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
});
