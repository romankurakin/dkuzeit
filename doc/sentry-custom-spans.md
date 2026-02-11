# Custom Sentry Spans

| `op`        | `name`               | Why                                        |
| ----------- | -------------------- | ------------------------------------------ |
| `cache.get` | `{key}`              | Cache hit rate is the main perf lever      |
| `function`  | `parseTimetablePage` | HTML parse time per schedule page          |
| `serialize` | `buildIcsCalendar`   | ICS serialization time for calendar export |
