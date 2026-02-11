import type { LessonEvent } from '$lib/server/types';

const PALETTE = [
	'red',
	'amber',
	'lime',
	'emerald',
	'teal',
	'cyan',
	'sky',
	'blue',
	'violet',
	'pink'
] as const;

export type HarmonyColor = (typeof PALETTE)[number];

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
		map.set(subject, PALETTE[idx]!);
	}
	return map;
}

export function cv(color: HarmonyColor, shade: number): string {
	return `var(--color-${color}-${shade})`;
}

// TW v4 safelist, these literals make the scanner emit the @theme CSS vars.
// Must match PALETTE above — only shade 400 is used at runtime via cv().
export const _TW_SAFELIST = [
	'bg-red-400',
	'bg-amber-400',
	'bg-lime-400',
	'bg-emerald-400',
	'bg-teal-400',
	'bg-cyan-400',
	'bg-sky-400',
	'bg-blue-400',
	'bg-violet-400',
	'bg-pink-400'
];
