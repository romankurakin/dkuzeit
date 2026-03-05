export function toWebcalLink(calendarUrl: string): string {
	return calendarUrl.replace(/^https?:\/\//i, 'webcal://');
}

export function openCalendarSubscription(
	url: string,
	assign: (targetUrl: string) => void = (targetUrl) => location.assign(targetUrl)
): boolean {
	try {
		assign(url);
		return true;
	} catch {
		// Opening protocol handlers is browser-dependent; ignore synchronous failures.
		return false;
	}
}
