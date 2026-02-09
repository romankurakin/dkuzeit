export function decodeHtml(value: string): string {
	return value
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function stripTags(input: string): string {
	return decodeHtml(input.replace(/<[^>]*>/g, ' '));
}

export function cleanText(input: string): string {
	return stripTags(input)
		.replace(/\u00a0/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function russianOnlyLabel(input: string): string {
	const value = cleanText(input).replace(/^[.*]+/, '');
	const slashIdx = value.indexOf('/');
	if (slashIdx === -1) return value;
	return value.slice(0, slashIdx).trim() || value;
}

export function germanOnlyLabel(input: string): string {
	const value = cleanText(input).replace(/^[.*]+/, '');
	const slashIdx = value.indexOf('/');
	if (slashIdx === -1) return value;
	const rest = value.slice(slashIdx + 1).trim();
	// Strip Cyrillic suffix (lesson type), keep only the Latin German name
	const match = rest.match(/^(.*?)\s+[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/);
	return (match ? match[1]!.trim() : rest) || value;
}

/**
 * Extract Cyrillic lesson-type suffix from a bilingual full subject name.
 * "Социология/Soziologie лекция/семинар" → "лекция/семинар"
 * "Немецкий язык/Deutsch пр." → "пр."
 */
export function extractLessonType(input: string): string {
	const value = cleanText(input).replace(/^[.*]+/, '');
	const slashIdx = value.indexOf('/');
	if (slashIdx === -1) {
		const known = value.match(/\s+(пр\.|лек\.|лекция|практика|семинар)$/);
		return known ? known[1]! : '';
	}
	const rest = value.slice(slashIdx + 1).trim();
	const match = rest.match(/\s+([А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ].*)$/);
	return match ? match[1]! : '';
}

export function stripParenSuffix(value: string): string {
	return value.replace(/\s*\(.*$/, '');
}

export function normalizeCodeKey(input: string): string {
	return cleanText(input)
		.replace(/^\.+/, '')
		.replace(/\s+/g, '')
		.replace(/\/$/, '')
		.toUpperCase();
}

export function leftSideCode(input: string): string {
	const left = cleanText(input).split('/')[0] ?? input;
	return normalizeCodeKey(left);
}

