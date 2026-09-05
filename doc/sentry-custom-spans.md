# Parser observability

Server application spans are emitted only to Cloudflare native tracing. This keeps the parser,
cache, and calendar-serialization path in the same request trace as `cloudflare.cpu_time_ms` and
`cloudflare.wall_time_ms` without creating a second server trace tree in Sentry. Sentry remains
responsible for errors, browser performance spans, and Application Metrics.

Sentry Application Metrics provide a separate aggregate signal for comparing input and output
workloads. They do not share a trace ID with Cloudflare native spans and are not used as a parser
stopwatch. Compare the two systems by release and experiment window.

| `op`                 | `name`                                | What it establishes                                |
| -------------------- | ------------------------------------- | -------------------------------------------------- |
| `cache.get`          | `meta cache`, `schedule cache`        | Whether the expensive path ran at all              |
| `source.resolve`     | `resolve source page`                 | The complete cache-miss path                       |
| `html.parse`         | `build DOM with htmlparser2`          | Bytes were streamed through the actual HTML parser |
| `timetable.extract`  | `extract timetable metadata from DOM` | Navbar DOM traversal and normalization             |
| `timetable.extract`  | `extract timetable from DOM`          | Schedule DOM traversal and event construction      |
| `calendar.serialize` | `serialize ics calendar`              | ICS serialization for calendar export              |

## Reading a trace

`0 ms` on `html.parse` or `timetable.extract` does not mean that the operation was free. In a
deployed Worker, `Date.now()` and `performance.now()` only advance after I/O. A CPU-only span can
therefore have identical start and end timestamps. See Cloudflare's
[timer documentation](https://developers.cloudflare.com/workers/runtime-apis/performance/) and
[tracing limitation](https://developers.cloudflare.com/workers/observability/traces/known-limitations/).

The spans answer **where did the request go?** Their attributes make before/after samples
comparable:

- `html.parser=htmlparser2` and `html.phase=dom.build` identify DOM construction.
- `html.input_bytes` records the actual number of streamed response bytes.
- `html.phase=schedule.extract` identifies the custom DOM traversal.
- `timetable.event_count` and `timetable.cohort_count` record the output workload.
- `cache.hit=false` proves that the parser path was exercised.

The request root's `cloudflare.cpu_time_ms` answers **how much CPU did the complete invocation
use?** A local CPU profile and the phase benchmark identify which functions consumed it.

## Application Metrics

The metrics are emitted independently of the Cloudflare trace and aggregated in Sentry:

- `dku.cache.access` records hit/miss counters with `cache.kind` and `cache.result`.
- `dku.html.input_bytes` records an input-size distribution with `html.parser` and `source.kind`.
- `dku.timetable.events` and `dku.timetable.cohorts` record output-size distributions.
- `dku.schedule.view` counts successfully rendered schedules.
- `dku.calendar.subscription` counts successfully issued calendar subscription links.

Attributes are intentionally low-cardinality. Cache keys, group codes, week values, paths, and trace
IDs are not copied into metric attributes. There is intentionally no parser-duration metric because
it would inherit the Worker timer limitation described above.

The two business counters share only the low-cardinality `ui.locale` attribute. Their ratio is the
calendar-subscription conversion rate:

```text
sum(dku.calendar.subscription) / sum(dku.schedule.view) * 100
```

`dku.calendar.subscription` measures a successful subscription attempt: the application created a
signed feed URL and handed it to the client. Calendar applications do not provide a reliable
confirmation callback after the user accepts the subscription.

## Reproducible local evidence

Run the fixture benchmark:

```sh
pnpm bench:parser
```

It reports the median of seven rounds separately for:

1. DOM construction by `htmlparser2`.
2. Timetable extraction from an already-built DOM.
3. The complete parsing pipeline.

Use `pnpm bench:parser -- --json` to capture machine-readable before/after results. For a workerd
CPU flame chart, run the Worker with Wrangler, press `D`, record in the Profiler tab, and exercise
cache misses with the same fixture pages. Cloudflare documents this workflow in
[Profiling CPU usage](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).

## Production before/after protocol

1. Add this instrumentation to both variants, then compare two Worker versions with identical routes
   and equivalent timetable pages.
2. Select only requests where `cache.hit=false` and `html.input_bytes` is in the same range.
3. Compare a distribution of `cloudflare.cpu_time_ms` (median and p95), not a single trace.
4. Verify that event and cohort counts stay equivalent so a CPU drop is not caused by lost output.
5. Keep the `0 ms` child span in the screenshots: it demonstrates the timer limitation, while the
   root CPU distribution and local profile demonstrate the cost.

Do not add artificial I/O between timestamps to force the clock to advance. It changes the workload
and still does not turn child-span duration into a trustworthy CPU measurement.

## Historical anchors for the talk

The repository already contains a stronger, factual optimization story:

- The parent of `4864402` ran `parse5 → serialize → parse5` for every schedule page through
  `normalizeHtml()`. Commit `4864402` removed that round-trip. Its commit message records the same
  780-page fixture benchmark dropping from 2094 ms to 873 ms (2.4×).
- Commit `c7bb717` then replaced the parse5 DOM implementation with Cloudflare's HTMLRewriter
  streaming API.
- Commit `7957130` moved the fetch path to the current Web Stream → htmlparser2 DOM construction.

Use those revisions as the code narrative. Do not compare their 780-page number directly with the
current 112-page fixture snapshot, and do not claim that the current parser takes 20–40 ms per page
without a matching production CPU profile. The current benchmark is evidence for the present code;
the historical benchmark and production root CPU metrics are evidence for the optimization.
