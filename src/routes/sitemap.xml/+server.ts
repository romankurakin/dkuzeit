import { getMeta } from '$lib/server/dku';
import { toSlug } from '$lib/url-slug';
import type { RequestHandler } from './$types';

const ORIGIN = 'https://dkuzeit.net';

export const GET: RequestHandler = async () => {
	const meta = await getMeta();

	const groupSlugs = meta.groups.map((g) => toSlug(g.codeRu));

	const urls: { loc: string; alternatives: { lang: string; href: string }[] }[] = [
		{
			loc: `${ORIGIN}/`,
			alternatives: [
				{ lang: 'ru', href: `${ORIGIN}/` },
				{ lang: 'de', href: `${ORIGIN}/de/` },
				{ lang: 'x-default', href: `${ORIGIN}/` }
			]
		}
	];

	for (const slug of groupSlugs) {
		urls.push({
			loc: `${ORIGIN}/${slug}`,
			alternatives: [
				{ lang: 'ru', href: `${ORIGIN}/${slug}` },
				{ lang: 'de', href: `${ORIGIN}/de/${slug}` },
				{ lang: 'x-default', href: `${ORIGIN}/${slug}` }
			]
		});
	}

	const xml = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urls.map(
			(u) =>
				`  <url>\n    <loc>${u.loc}</loc>\n${u.alternatives.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${a.href}" />`).join('\n')}\n  </url>`
		),
		'</urlset>'
	].join('\n');

	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=86400'
		}
	});
};
