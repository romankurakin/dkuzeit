# Custom Sentry Spans

| `op`          | `name`               | Why                                           |
| ------------- | -------------------- | --------------------------------------------- |
| `cache.get`   | `{key}`              | Cache hit rate is the main perf lever         |
| `http.client` | `GET …/navbar.htm`   | Gateway dep, whole app breaks if this is down |
| `http.client` | `GET …/{path}`       | Upstream latency per schedule page            |
| `function`    | `parseTimetablePage` | HTMLRewriter parse time per schedule page     |
| `serialize`   | `buildIcsCalendar`   | ICS serialization time for calendar export    |
