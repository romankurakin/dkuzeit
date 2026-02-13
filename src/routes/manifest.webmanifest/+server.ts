import { getLocale } from '$lib/paraglide/runtime';
import type { RequestHandler } from './$types';

const manifests = {
	ru: {
		name: 'Расписание Немецко-Казахстанского университета в Алматы',
		short_name: 'Расписание DKU',
		description: 'Расписание занятий DKU — по группам, по неделям, с Apple Календарём.'
	},
	de: {
		name: 'Stundenplan der Deutsch-Kasachischen Universität Almaty',
		short_name: 'Stundenplan DKU',
		description: 'Stundenplan der DKU — nach Gruppen, nach Wochen, mit Apple Kalender.'
	}
} as const;

export const GET: RequestHandler = () => {
	const lang = getLocale();
	const localized = manifests[lang as keyof typeof manifests] ?? manifests.ru;

	const manifest = {
		...localized,
		lang,
		start_url: '/',
		scope: '/',
		theme_color: '#fafafa',
		background_color: '#141414',
		display: 'standalone',
		icons: [
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
			{ src: '/icon-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
		]
	};

	return new Response(JSON.stringify(manifest), {
		headers: { 'Content-Type': 'application/manifest+json' }
	});
};
