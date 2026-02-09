import { cleanText } from './text';

export function parseCohortsCsv(raw: string | null | undefined): string[] {
	return (raw ?? '')
		.split(',')
		.map((item) => cleanText(item))
		.filter(Boolean);
}

export function normalizeCohortList(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((item) => cleanText(String(item))).filter(Boolean);
}
