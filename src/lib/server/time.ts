export const ALMATY_TIME_ZONE = 'Asia/Almaty';

// Runtime configuration: e2e pins the clock inside the fixture snapshot's
// week range via wrangler.toml [env.e2e]; unset everywhere else, so the
// real clock is used.
export function nowDate(): Date {
	const pinned = process.env.DKU_NOW;
	return pinned ? new Date(pinned) : new Date();
}

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

export function todayInAlmaty(now: Date = nowDate()): string {
	return almatyParts(now).dateIso;
}

export function isSundayInAlmaty(now: Date = nowDate()): boolean {
	return almatyParts(now).weekday === 'Sunday';
}
