import type { LessonEvent } from '$lib/components/timetable/types';

const PALETTE = [
	'blue',
	'emerald',
	'rose',
	'violet',
	'amber',
	'teal',
	'fuchsia',
	'sky',
	'orange',
	'lime',
	'indigo',
	'pink',
	'cyan',
	'red',
	'purple'
] as const;

export type HarmonyColor = (typeof PALETTE)[number];

function djb2(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export function buildSubjectColorMap(events: LessonEvent[]): Map<string, HarmonyColor> {
	const subjects = [...new Set(events.map((e) => e.subjectShortRu).filter(Boolean))].sort();
	const map = new Map<string, HarmonyColor>();
	const usedIndices = new Set<number>();
	for (const subject of subjects) {
		let idx = djb2(subject) % PALETTE.length;
		while (usedIndices.has(idx) && usedIndices.size < PALETTE.length) {
			idx = (idx + 1) % PALETTE.length;
		}
		usedIndices.add(idx);
		map.set(subject, PALETTE[idx]!);
	}
	return map;
}

export function cv(color: HarmonyColor, shade: number): string {
	return `var(--color-${color}-${shade})`;
}

/**
 * Tailwind v4 tree-shakes @theme CSS variables that aren't used by any utility class.
 * This safelist ensures the scanner sees these class names so it emits the variables.
 * The array is never used at runtime — only its string literals matter for the scanner.
 */
export const _TW_SAFELIST = [
	'bg-blue-50', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600', 'bg-blue-700', 'bg-blue-800', 'bg-blue-900', 'bg-blue-950',
	'bg-emerald-50', 'bg-emerald-300', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600', 'bg-emerald-700', 'bg-emerald-800', 'bg-emerald-900', 'bg-emerald-950',
	'bg-rose-50', 'bg-rose-300', 'bg-rose-400', 'bg-rose-500', 'bg-rose-600', 'bg-rose-700', 'bg-rose-800', 'bg-rose-900', 'bg-rose-950',
	'bg-violet-50', 'bg-violet-300', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-700', 'bg-violet-800', 'bg-violet-900', 'bg-violet-950',
	'bg-amber-50', 'bg-amber-300', 'bg-amber-400', 'bg-amber-500', 'bg-amber-600', 'bg-amber-700', 'bg-amber-800', 'bg-amber-900', 'bg-amber-950',
	'bg-teal-50', 'bg-teal-300', 'bg-teal-400', 'bg-teal-500', 'bg-teal-600', 'bg-teal-700', 'bg-teal-800', 'bg-teal-900', 'bg-teal-950',
	'bg-fuchsia-50', 'bg-fuchsia-300', 'bg-fuchsia-400', 'bg-fuchsia-500', 'bg-fuchsia-600', 'bg-fuchsia-700', 'bg-fuchsia-800', 'bg-fuchsia-900', 'bg-fuchsia-950',
	'bg-sky-50', 'bg-sky-300', 'bg-sky-400', 'bg-sky-500', 'bg-sky-600', 'bg-sky-700', 'bg-sky-800', 'bg-sky-900', 'bg-sky-950',
	'bg-orange-50', 'bg-orange-300', 'bg-orange-400', 'bg-orange-500', 'bg-orange-600', 'bg-orange-700', 'bg-orange-800', 'bg-orange-900', 'bg-orange-950',
	'bg-lime-50', 'bg-lime-300', 'bg-lime-400', 'bg-lime-500', 'bg-lime-600', 'bg-lime-700', 'bg-lime-800', 'bg-lime-900', 'bg-lime-950',
	'bg-indigo-50', 'bg-indigo-300', 'bg-indigo-400', 'bg-indigo-500', 'bg-indigo-600', 'bg-indigo-700', 'bg-indigo-800', 'bg-indigo-900', 'bg-indigo-950',
	'bg-pink-50', 'bg-pink-300', 'bg-pink-400', 'bg-pink-500', 'bg-pink-600', 'bg-pink-700', 'bg-pink-800', 'bg-pink-900', 'bg-pink-950',
	'bg-cyan-50', 'bg-cyan-300', 'bg-cyan-400', 'bg-cyan-500', 'bg-cyan-600', 'bg-cyan-700', 'bg-cyan-800', 'bg-cyan-900', 'bg-cyan-950',
	'bg-red-50', 'bg-red-300', 'bg-red-400', 'bg-red-500', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900', 'bg-red-950',
	'bg-purple-50', 'bg-purple-300', 'bg-purple-400', 'bg-purple-500', 'bg-purple-600', 'bg-purple-700', 'bg-purple-800', 'bg-purple-900', 'bg-purple-950',
];
