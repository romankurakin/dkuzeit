import { createSearchParamsSchema } from 'runed/kit';

export const scheduleSearchSchema = createSearchParamsSchema({
	week: { type: 'string', default: '' },
	cohorts: { type: 'string', default: '' }
});
