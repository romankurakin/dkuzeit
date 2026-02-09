const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(locale: string): Intl.DateTimeFormat {
	let fmt = formatters.get(locale);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat(locale, {
			weekday: 'long',
			day: 'numeric',
			month: 'short'
		});
		formatters.set(locale, fmt);
	}
	return fmt;
}

export function formatDateLabel(dateIso: string, uiLocale: 'ru' | 'de'): string {
	const date = new Date(`${dateIso}T00:00:00+05:00`);
	return getFormatter(uiLocale === 'de' ? 'de-DE' : 'ru-RU').format(date);
}
