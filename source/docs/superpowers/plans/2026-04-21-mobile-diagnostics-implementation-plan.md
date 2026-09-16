# Mobile Diagnostics Implementation Plan

- Date: 2026-04-21
- Related spec: `docs/superpowers/specs/2026-04-21-mobile-diagnostics-design.md`
- Goal: Implement first-party mobile diagnostics for handled errors, inferred crashes, API failures, breadcrumbs, and structured operational logs without adding a third-party monitoring service

## Outcome

At the end of this plan, the mobile app should be able to collect redacted diagnostics events, persist them locally when offline, flush them through an authenticated backend route, and store them in Supabase for debugging. The first release should support:

- handled error capture
- unhandled JavaScript/runtime error capture
- inferred crash reporting on next launch
- API failure capture
- screen and action breadcrumbs
- balanced redaction on both client and server

## Delivery Sequence

1. Add shared contracts and storage schema.
2. Add the backend ingest route and persistence path.
3. Add the mobile diagnostics core and local persistence.
4. Instrument key mobile flows.
5. Verify end-to-end storage and retry behavior.

## Phase 1: Shared Contracts And Database Schema

### Tasks

- Add diagnostics event and batch schemas to `packages/contracts/src/index.ts`.
- Export shared types for:
  - event type
  - severity
  - category
  - breadcrumb entry
  - redacted context payload
  - ingest request and response payloads
- Define explicit field requirements for:
  - `id`
  - `deviceId`
  - `sessionId`
  - `occurredAt`
  - `eventType`
  - `severity`
  - `message`
  - `context`
  - `breadcrumbs`
- Add fingerprint guidance in the shared type comments so client and server use the same grouping logic.
- Add a database migration or checked-in SQL artifact to create `diagnostic_events`.

### Proposed storage schema

- Required columns:
  - `id uuid primary key`
  - `agent_id uuid not null`
  - `device_id text not null`
  - `session_id text not null`
  - `event_type text not null`
  - `category text not null`
  - `severity text not null`
  - `message text not null`
  - `fingerprint text null`
  - `screen text null`
  - `app_version text null`
  - `build_number text null`
  - `platform text not null`
  - `request_path text null`
  - `http_status integer null`
  - `lead_id uuid null`
  - `appointment_id uuid null`
  - `pipeline_stage text null`
  - `context jsonb not null default '{}'::jsonb`
  - `breadcrumbs jsonb not null default '[]'::jsonb`
  - `tags jsonb not null default '{}'::jsonb`
  - `occurred_at timestamptz not null`
  - `received_at timestamptz not null default now()`
- Indexes:
  - `(agent_id, occurred_at desc)`
  - `(event_type, occurred_at desc)`
  - `(severity, occurred_at desc)`
  - `(fingerprint, occurred_at desc)` for later issue grouping

### Acceptance criteria

- Mobile and backend compile against the same diagnostics payload types.
- The schema clearly supports append-only writes and idempotent retries via client-generated `id`.
- The SQL artifact can be applied without relying on a third-party service.

## Phase 2: Backend Ingest Route

### Tasks

- Add `apps/intake-web/app/api/mobile/diagnostics/route.ts`.
- Reuse `requireMobileAgent(request)` for auth.
- Parse request bodies using the shared diagnostics batch schema.
- Add a normalization layer that:
  - overwrites `agent_id` from authenticated context
  - rejects empty batches
  - caps batch size
  - strips disallowed fields even if the client sends them
- Add `recordDiagnosticEvents(...)` to `apps/intake-web/lib/supabase/data.ts`.
- Insert rows in bulk using the authenticated agent context.
- Return a structured response with:
  - accepted count
  - rejected count
  - optional rejected event IDs for client-side dropping when input is invalid

### Tests

- Route test: missing bearer token returns `401`
- Route test: malformed payload returns `400`
- Route test: valid batch inserts rows and returns accepted counts
- Route test: disallowed fields are removed or rejected according to policy
- Data-layer test: mapped row shape matches the table contract

### Acceptance criteria

- The route follows the same auth and test patterns as existing mobile endpoints.
- Retries are safe because row identity is based on client-generated event IDs.
- Bad events do not prevent valid events in the same batch from being stored.

## Phase 3: Mobile Diagnostics Core

### Tasks

- Add a diagnostics module under `apps/agent-mobile/lib/diagnostics/`.
- Use `@react-native-async-storage/async-storage` for local diagnostics persistence.
- Implement:
  - `client.ts` for public APIs
  - `redaction.ts` for allowlist-based sanitization
  - `store.ts` for queue and breadcrumb persistence
  - `runtime.ts` for lifecycle and flush orchestration
  - `types.ts` for local helper types if needed
- Generate and persist:
  - `deviceId` once per install
  - `sessionId` once per launch
  - active-session sentinel
  - breadcrumb ring buffer
- Implement bounded queue behavior:
  - keep crash and error events before low-severity logs
  - drop oldest low-priority entries first when full
- Implement flush behavior:
  - small batch size
  - backoff on failure
  - safe retry using stable event IDs
- Record `diagnostics.internal` when the pipeline can recover from its own failure without recursion loops.

### Root wiring

- Initialize diagnostics in `apps/agent-mobile/app/_layout.tsx` before the main navigation tree becomes active.
- Use `AppState` transitions to mark session active/inactive.
- Detect stale sentinels on launch and emit `crash.inferred` with the prior breadcrumb snapshot.

### Acceptance criteria

- The app can queue events offline and flush them later.
- The queue cannot grow without bound.
- A stale prior-run sentinel produces an inferred crash event exactly once.

## Phase 4: Instrument Key Flows

### Tasks

- Add screen breadcrumbs from the current Expo Router location.
- Instrument `packages/infrastructure/src/mobile-api.ts` so request failures emit `api.failure`.
- Capture selected context for API failures:
  - request path
  - method
  - status
  - event source
  - selected domain IDs when already available
- Instrument `apps/agent-mobile/providers/session-provider.tsx` for:
  - bootstrap failures
  - auth restore failures
  - push token registration failures
  - sign-out failures
- Instrument `apps/agent-mobile/app/(auth)/sign-in.tsx` for sign-in failures.
- Add action events for core user flows:
  - create invite
  - review lead
  - move lead stage
  - save appointment
  - update appointment status
  - save settings

### Global error capture

- Add a top-level React error boundary around the app tree for render-time failures.
- Add a runtime-level unhandled JavaScript error hook if the Expo/React Native runtime permits it cleanly in this codebase.
- If the global error hook is brittle in development, gate it to production-like builds and keep testable behavior in the boundary and explicit capture calls.

### Acceptance criteria

- Failures in key mobile flows produce observable diagnostics rows with useful breadcrumbs.
- Instrumentation does not leak blocked fields such as emails, addresses, notes, freeform answers, or tokens.
- Diagnostics logic does not change user-facing success and failure behavior.

## Phase 5: Verification And Rollout

### Automated verification

- Add mobile unit tests for:
  - redaction rules
  - queue capacity and retention
  - retry behavior
  - inferred-crash sentinel lifecycle
- Add backend tests for:
  - authentication
  - payload validation
  - redaction enforcement
  - insert mapping

### Manual verification

- Trigger a handled error from a controlled code path and confirm it lands in Supabase.
- Force an API failure and confirm `api.failure` includes request path, status, and breadcrumb context.
- Simulate a stale sentinel and confirm `crash.inferred` is emitted on next launch.
- Verify that blocked fields do not appear in stored `context` or `breadcrumbs`.
- Confirm duplicate retries do not create duplicate rows for the same event IDs.

### Rollout notes

- Start with instrumentation limited to startup, auth, navigation, and API failures.
- After confirming signal quality in Supabase, expand action events to more screens as needed.
- Do not add alerting or dashboards until stored event quality is proven.

## File-Level Worklist

### Shared packages

- `packages/contracts/src/index.ts`
- `packages/infrastructure/src/mobile-api.ts`
- `packages/infrastructure/tests/...`

### Mobile app

- `apps/agent-mobile/app/_layout.tsx`
- `apps/agent-mobile/app/(auth)/sign-in.tsx`
- `apps/agent-mobile/providers/session-provider.tsx`
- `apps/agent-mobile/lib/diagnostics/*`
- mobile tests for diagnostics modules

### Web app

- `apps/intake-web/app/api/mobile/diagnostics/route.ts`
- `apps/intake-web/lib/supabase/data.ts`
- route and data-layer tests

### Database artifact

- a checked-in SQL migration or schema file for `diagnostic_events`

## Suggested Implementation Order For The First Coding Pass

1. Contracts and SQL artifact
2. Backend ingest route with tests
3. Mobile diagnostics core with queue tests
4. API failure instrumentation
5. Root lifecycle and inferred-crash sentinel
6. Auth and key action instrumentation
7. Manual end-to-end verification

## Definition Of Done

- Diagnostics events can be captured on mobile, queued locally, and persisted to Supabase through the authenticated backend route.
- The system records handled errors, API failures, navigation breadcrumbs, and inferred crashes.
- Redaction rules are enforced on both client and server.
- Retry behavior is idempotent.
- Automated tests cover the highest-risk paths.
- No monitoring UI or alerting work is added in this implementation.
