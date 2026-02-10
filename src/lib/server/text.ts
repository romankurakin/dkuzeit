function decodeHtml(value: string): string {
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
	// Strip Cyrillic suffix, keep Latin German name
	const match = rest.match(/^(.*?)\s+[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/);
	return (match ? match[1]!.trim() : rest) || value;
}

export function stripParenSuffix(value: string): string {
	return value.replace(/\s*\(.*$/, '');
}
