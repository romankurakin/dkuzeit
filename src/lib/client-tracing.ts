import * as Sentry from '@sentry/sveltekit';

type AttrValue = boolean | number | string;
type Attrs = Record<string, AttrValue | null | undefined>;

type ScheduleTraceContext = {
	days?: number;
	events?: number;
	group?: string;
	locale?: string;
	week?: string;
};

function attrs(input: Attrs): Record<string, AttrValue> {
	return Object.fromEntries(
		Object.entries(input).filter(
			([, value]) => value !== undefined && value !== null && value !== ''
		)
	) as Record<string, AttrValue>;
}

export function traceNavigate<T>(
	target: string,
	type: 'invalidate' | 'goto',
	fn: () => Promise<T>
): Promise<T> {
	return Sentry.startSpan(
		{
			name: type,
			op: 'ui.navigate',
			attributes: attrs({ 'ui.navigate.type': type, 'ui.route': target })
		},
		fn
	);
}

export function traceCalendarExport<T>(
	context: ScheduleTraceContext,
	fn: () => Promise<T>
): Promise<T> {
	return Sentry.startSpan(
		{
			name: 'calendarExport',
			op: 'ui.calendar_export',
			attributes: attrs({
				'schedule.group': context.group,
				'schedule.week': context.week,
				'ui.locale': context.locale
			})
		},
		fn
	);
}

export function traceInitialRender(startTime: number, context: ScheduleTraceContext): void {
	Sentry.startSpan(
		{
			name: 'scheduleRender',
			op: 'ui.initial_render',
			startTime,
			attributes: attrs({
				'schedule.days': context.days,
				'schedule.events': context.events,
				'schedule.group': context.group,
				'schedule.week': context.week,
				'ui.locale': context.locale
			})
		},
		() => {}
	);
}
