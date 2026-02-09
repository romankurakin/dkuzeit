const CYRILLIC_START_AFTER_SLASH = /^[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/;
const GERMAN_NAME_PREFIX_RE = /^(.*?)\s+[А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ]/;
const LESSON_TYPE_SUFFIX_RE = /\s+([А-Яа-яЁёҚқӘәҒғҢңӨөҰұҮүІіҺһ].*)$/;
const KNOWN_LESSON_TYPE_RE = /\s+(пр\.|лек\.|лекция|практика|семинар)$/;

/** Detect bilingual names where the part after "/" is Kazakh, not German */
export function isMissingGermanName(subjectFullRaw: string): boolean {
	const slashIdx = subjectFullRaw.indexOf('/');
	if (slashIdx === -1) return false;
	const afterSlash = subjectFullRaw.slice(slashIdx + 1).trim();
	return CYRILLIC_START_AFTER_SLASH.test(afterSlash);
}

export function splitBilingualLabel(
	raw: string,
	noGerman: boolean
): { ru: string; de: string; lessonType: string } {
	const value = raw.replace(/^[.*]+/, '').trim();
	const slashIdx = value.indexOf('/');
	if (slashIdx === -1) {
		const ltMatch = value.match(KNOWN_LESSON_TYPE_RE);
		if (ltMatch) {
			const stripped = value.slice(0, -ltMatch[0].length).trim();
			return { ru: stripped, de: stripped, lessonType: ltMatch[1]! };
		}
		return { ru: value, de: value, lessonType: '' };
	}

	const ru = value.slice(0, slashIdx).trim() || value;
	const rest = value.slice(slashIdx + 1).trim();
	const lessonTypeMatch = rest.match(LESSON_TYPE_SUFFIX_RE);
	const lessonType = lessonTypeMatch ? lessonTypeMatch[1]! : '';
	if (noGerman) return { ru, de: ru, lessonType };

	const germanMatch = rest.match(GERMAN_NAME_PREFIX_RE);
	const de = (germanMatch ? germanMatch[1]!.trim() : rest) || value;
	return { ru, de, lessonType };
}

/** Strip trailing slashes, leading dashes and other source data artifacts */
export function sanitizeLabel(value: string): string {
	return value.replace(/\/$/, '').replace(/^-+/, '').trim();
}
