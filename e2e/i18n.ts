import de from '../messages/de.json' with { type: 'json' };
import ru from '../messages/ru.json' with { type: 'json' };

type Messages = typeof ru;

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function localizedMessageRegex(key: keyof Messages): RegExp {
	const values = [ru[key], de[key]]
		.map((value) => String(value ?? '').trim())
		.filter((value) => value.length > 0)
		.map(escapeRegex);

	return new RegExp(`^(?:${values.join('|')})$`, 'i');
}
