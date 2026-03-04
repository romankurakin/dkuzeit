export const ALMATY_TIME_ZONE = 'Asia/Almaty';

const almatyDateFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: ALMATY_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	weekday: 'long'
});

function almatyParts(now: Date) {
	const parts = almatyDateFormatter.formatToParts(now);
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
	return { dateIso: `${get('year')}-${get('month')}-${get('day')}`, weekday: get('weekday') };
}

export function todayInAlmaty(now: Date = new Date()): string {
	return almatyParts(now).dateIso;
}

export function isSundayInAlmaty(now: Date = new Date()): boolean {
	return almatyParts(now).weekday === 'Sunday';
}
