# Mobile Diagnostics Design

- Date: 2026-04-21
- Product: ShowReady mobile app
- Status: Approved for spec drafting
- Scope: In-house mobile diagnostics for handled errors, inferred crashes, API failures, breadcrumbs, and structured operational logs

## Summary

ShowReady needs first-party diagnostics for the Expo mobile app so bugs are easier to reproduce and production failures are easier to investigate. The selected approach is an authenticated mobile diagnostics pipeline that captures events in the app, persists a bounded local queue, and flushes batched events to the existing Next.js backend. The backend validates and stores append-only diagnostic rows in Supabase.

This design intentionally does not add a monitoring UI, issue grouping, or native crash SDK integration in v1. The initial goal is reliable collection, safe redaction, and enough context to debug failures from Supabase or the database directly.

## Goals

- Capture unhandled and handled mobile errors in a consistent format.
- Detect likely app crashes on the next launch using an inferred-crash sentinel.
- Record API failures, navigation breadcrumbs, and important operational events.
- Keep diagnostics in the existing application stack instead of adding a third-party service.
- Enforce balanced redaction so debugging context is preserved without storing customer content or secrets.
- Ensure diagnostics never block normal app behavior.

## Non-Goals

- Native crash dumps or symbolicated native stack traces.
- A new internal diagnostics UI.
- Automated alerting or issue aggregation.
- Logging full request or response payloads from customer-facing flows.
- Replacing application-level user-facing error handling.

## Selected Approach

The app will send authenticated diagnostic batches to a new `POST /api/mobile/diagnostics` endpoint in `apps/intake-web`. The endpoint will reuse the current bearer-token mobile authentication flow via `requireMobileAgent()`, validate the payload through shared contracts, re-apply redaction guards, and write append-only rows to a new Supabase table named `diagnostic_events`.

The mobile app will not write diagnostics directly to Supabase. All diagnostics writes will go through the backend ingest route so the server remains the policy boundary for validation, redaction enforcement, and future storage evolution.

## Architecture

### Mobile pipeline

The mobile app will introduce a dedicated diagnostics module with these responsibilities:

- Provide a narrow public API for `captureError`, `logEvent`, `addBreadcrumb`, `markScreen`, and `flush`.
- Redact event payloads before they are persisted or transmitted.
- Persist a bounded local queue and breadcrumb ring buffer.
- Manage lifecycle hooks such as startup initialization, inferred-crash detection, periodic flush, and retry behavior.
- Instrument key app flows without spreading backend write logic across screens.

Root diagnostics initialization should happen before the main app tree is fully active so startup failures and launch state are observable. Initial wiring points are:

- `apps/agent-mobile/app/_layout.tsx`
- `apps/agent-mobile/providers/session-provider.tsx`
- `packages/infrastructure/src/mobile-api.ts`

### Server pipeline

The backend will add:

- A new `POST /api/mobile/diagnostics` route in `apps/intake-web/app/api/mobile/diagnostics/route.ts`
- Shared request schemas in `packages/contracts`
- A data-layer write function in `apps/intake-web/lib/supabase/data.ts`

The ingest endpoint will:

1. Authenticate the caller with the same bearer-token flow used by current mobile endpoints.
2. Parse and validate a batch payload.
3. Apply a second-pass server-side redaction guard.
4. Persist valid rows to `diagnostic_events`.
5. Return accepted and rejected counts so the client can reason about flush results.

## Components

### Mobile components

- `diagnostics/client`
  - Public entrypoint used by app code.
- `diagnostics/redaction`
  - Converts raw context into an allowed subset.
- `diagnostics/store`
  - Stores a bounded queue of pending events and a fixed-size breadcrumb history.
- `diagnostics/runtime`
  - Owns startup, session state, flush intervals, retry/backoff, and inferred-crash detection.
- `diagnostics/instrumentation`
  - Thin wrappers around screen tracking, auth lifecycle, notification lifecycle, and API failures.

### Server components

- `POST /api/mobile/diagnostics`
  - Authenticated batch ingest route.
- Diagnostics schemas in `packages/contracts`
  - Shared request and event typing.
- `recordDiagnosticEvents(...)`
  - Data-layer writer for append-only storage.

## Data Model

### Table

Create one append-only table:

- `diagnostic_events`

### Core columns

- `id`
- `agent_id`
- `device_id`
- `session_id`
- `event_type`
- `category`
- `severity`
- `message`
- `fingerprint`
- `screen`
- `app_version`
- `build_number`
- `platform`
- `occurred_at`
- `received_at`

### JSON columns

- `context`
- `breadcrumbs`
- `tags`

### Optional indexed columns for targeted debugging

- `request_path`
- `http_status`
- `lead_id`
- `appointment_id`
- `pipeline_stage`

### Event families

- `crash.inferred`
- `error.unhandled`
- `error.handled`
- `api.failure`
- `auth.event`
- `navigation.screen`
- `action.event`
- `notification.event`
- `diagnostics.internal`

### Identity semantics

- `id` is a client-generated event UUID and must be stable across retries.
- `session_id` is generated once per app launch.
- `device_id` is an app-scoped opaque install identifier generated locally and reused across launches.

The server must treat `id` as the idempotency key for append-only inserts so the client can safely retry batches after uncertain network outcomes.

## Redaction Policy

Balanced redaction is the selected policy.

### Allowed fields

- Internal IDs such as `agent_id`, `lead_id`, and `appointment_id`
- Route names and screen names
- API path without tokens or freeform query content
- HTTP method and status code
- Platform, app version, build number, environment
- Enum-like values such as pipeline stage or action name
- Boolean flags and counts

### Blocked or redacted fields

- Email addresses
- Phone numbers
- Street addresses
- Lead notes
- Custom question answers containing free text
- Any intake form freeform content
- Authentication tokens
- Passwords
- Raw headers
- Full request or response bodies

Redaction must happen twice:

- First on the device before queueing
- Again on the server before persistence

## Data Flow

1. App launch initializes diagnostics.
2. A fresh `session_id` is created for the run.
3. The runtime loads or creates the persistent `device_id`.
4. The runtime writes a persisted sentinel indicating the app entered an active session.
5. Navigation changes and important actions add breadcrumbs to the ring buffer.
6. Handled failures call `captureError` or `logEvent`.
7. API instrumentation creates `api.failure` events with redacted request context.
8. Events are enqueued locally first.
9. The runtime flushes small batches to `POST /api/mobile/diagnostics`.
10. On normal app backgrounding, the runtime marks the session as no longer active but keeps recent breadcrumb state for the next foreground transition.
11. On the next foreground transition, the runtime marks the current session active again.
12. If the next launch finds a stale active sentinel from the prior launch, the runtime emits `crash.inferred` for the prior session with the stored breadcrumb history.

## Crash Reporting Model

The system supports two categories of crash reporting:

- Direct capture of JavaScript and explicitly surfaced fatal runtime errors
- Inferred crash reporting for abrupt app termination detected on the next launch

This is sufficient to expose many production failures, but it is not equivalent to a native crash SDK. The design must document that true native process crashes will not include native stack traces or symbolication in v1.

## Reliability And Failure Handling

- Diagnostics must never block app usage.
- Failures inside the diagnostics pipeline must be swallowed safely.
- Queue size must be bounded so local storage cannot grow without limit.
- When the queue is full, low-severity log events should be dropped before crash or error events.
- Flush attempts should retry with backoff for transient network or server failures.
- Retries must be safe to repeat after ambiguous outcomes because event IDs are client-generated and idempotent.
- Server writes remain append-only and side-effect free beyond persistence.
- Invalid events should not poison the full batch when partial acceptance is feasible.

## Testing Strategy

### Mobile tests

- Redaction unit tests covering allowed and blocked fields
- Queue policy unit tests covering cap enforcement and retention priority
- Runtime tests covering retry behavior and inferred-crash sentinel handling
- API instrumentation tests around `createMobileApiClient`

### Server tests

- Route tests for authentication failure
- Route tests for schema validation failure
- Route tests for successful batch acceptance
- Route tests for server-side redaction enforcement
- Data-layer tests for row mapping and persistence shape

### Manual verification

- Trigger a handled error and confirm a stored `error.handled` row
- Trigger an API failure and confirm a stored `api.failure` row
- Simulate a stale sentinel and confirm a stored `crash.inferred` row
- Verify redacted fields do not appear in persisted context

## Operational Notes

- Supabase will be the first read surface for diagnostics.
- The initial table should be queryable by `agent_id`, `event_type`, severity, and time range.
- This design keeps room for future issue grouping, dashboards, and alerts without changing the client contract.

## Risks

- Inferred crash detection can generate false positives after forced termination or OS kill scenarios.
- Over-instrumentation can create noisy logs if event naming is not kept intentional.
- Weak redaction rules would create privacy risk, so contract and unit test coverage must be strict.
- If batch size or retry policy is poorly tuned, low-connectivity sessions may build excessive backlog.

## Rollout

1. Add shared contracts and backend ingest path.
2. Add mobile diagnostics core with local queue and flush behavior.
3. Instrument startup, auth, navigation, and API failures.
4. Add inferred-crash sentinel support.
5. Verify end-to-end events in Supabase before expanding instrumentation breadth.

## Open Questions

There are no blocking open questions for the first implementation plan. The main documented limitation is the absence of native crash symbolication, which is acceptable for the in-house v1 chosen here.
