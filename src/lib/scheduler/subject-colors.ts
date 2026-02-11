import type { LessonEvent } from '$lib/server/types';

const PALETTE = [
	{ name: 'rose', shade: 400 },
	{ name: 'orange', shade: 300 },
	{ name: 'amber', shade: 400 },
	{ name: 'green', shade: 300 },
	{ name: 'teal', shade: 400 },
	{ name: 'cyan', shade: 300 },
	{ name: 'sky', shade: 400 },
	{ name: 'blue', shade: 300 },
	{ name: 'indigo', shade: 400 },
	{ name: 'violet', shade: 300 },
	{ name: 'fuchsia', shade: 400 },
	{ name: 'pink', shade: 300 }
] as const;

type HarmonyColorName = (typeof PALETTE)[number]['name'];
type HarmonyShade = (typeof PALETTE)[number]['shade'];

export type HarmonyColor = {
	name: HarmonyColorName;
	shade: HarmonyShade;
};

function djb2(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export function subjectColorKey(e: LessonEvent): string {
	return e.subjectFullRu || e.subjectShortRu;
}

export function buildSubjectColorMap(events: LessonEvent[]): Map<string, HarmonyColor> {
	const subjects = [...new Set(events.map(subjectColorKey).filter(Boolean))].sort();
	const map = new Map<string, HarmonyColor>();
	const usedIndices = new Set<number>();
	for (const subject of subjects) {
		let idx = djb2(subject) % PALETTE.length;
		while (usedIndices.has(idx) && usedIndices.size < PALETTE.length) {
			idx = (idx + 1) % PALETTE.length;
		}
		usedIndices.add(idx);
		const token = PALETTE[idx]!;
		map.set(subject, { name: token.name, shade: token.shade });
	}
	return map;
}

export function cv(color: HarmonyColor): string {
	return `var(--color-${color.name}-${color.shade})`;
}

// TW v4 safelist, these literals make the scanner emit the @theme CSS vars.
// Must match PALETTE above.
export const _TW_SAFELIST = [
	'bg-rose-400',
	'bg-orange-300',
	'bg-amber-400',
	'bg-green-300',
	'bg-teal-400',
	'bg-cyan-300',
	'bg-sky-400',
	'bg-blue-300',
	'bg-indigo-400',
	'bg-violet-300',
	'bg-fuchsia-400',
	'bg-pink-300'
];
