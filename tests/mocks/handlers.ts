import { http, HttpResponse } from 'msw';

export const handlers = [
	http.get('https://timetable.dku.kz/healthz', () => HttpResponse.text('ok'))
];
