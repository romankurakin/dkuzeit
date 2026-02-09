export const ALMATY_TIME_ZONE = 'Asia/Almaty';

const almatyDateFormatter = new Intl.DateTimeFormat('en-GB', {
	timeZone: ALMATY_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

export function todayInAlmaty(now: Date = new Date()): string {
	const parts = almatyDateFormatter.formatToParts(now);
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '01';
	return `${get('year')}-${get('month')}-${get('day')}`;
}
