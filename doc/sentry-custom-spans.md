# Custom Sentry Spans

| `op`                 | `name`                         | Why                                          |
| -------------------- | ------------------------------ | -------------------------------------------- |
| `cache.get`          | `meta cache`, `schedule cache` | Cache hit rate is the main perf lever        |
| `source.resolve`     | `resolve source page`          | Real miss-path cost: fetch -> build -> parse |
| `html.build`         | `build html document`          | Upstream HTML body to DOM document time      |
| `html.parse`         | `parse nav html`               | Navbar metadata extraction from DOM          |
| `html.parse`         | `parse timetable page`         | Schedule extraction from DOM per page        |
| `calendar.serialize` | `serialize ics calendar`       | ICS serialization time for calendar export   |
