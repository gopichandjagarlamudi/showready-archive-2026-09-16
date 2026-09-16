# Admin Analytics and Support Dashboard Design

- Date: 2026-07-14
- Product: ShowReady
- Status: Approved design; ready for written-spec review
- Scope: A simple, private, read-only web dashboard for the product owner

## Summary

ShowReady will add a dedicated `apps/admin-web` Next.js application to the existing pnpm monorepo. It will be a private, owner-only dashboard for first-party product analytics, agent account visibility, feedback review, and a small amount of operational context.

The dashboard will reuse the existing Supabase project and first-party event pipeline. It will not add an analytics vendor, duplicate event storage, or expose privileged Supabase credentials to the browser.

## Goals

- Let the owner understand product usage and key workflow volumes.
- Show a searchable list of ShowReady agent accounts and their aggregate activity.
- Provide a read-only view of feedback submitted from mobile Settings.
- Surface enough diagnostics and server-error context to help investigate support questions.
- Preserve the current privacy boundary: analytics are first-party and lead/client data is not exposed in the dashboard.

## Non-goals

- Support-team accounts, roles, or delegated access.
- Editing agent accounts, leads, appointments, feedback, or diagnostics.
- Ticket workflows, feedback statuses, assignment, replies, or customer messaging.
- A full BI product, real-time streaming dashboard, data export, or custom report builder.
- Displaying lead/client names, email addresses, phone numbers, addresses, notes, intake answers, or raw request payloads.
- Adding a third-party analytics or monitoring provider.

## Selected Architecture

Create `apps/admin-web` as a separate Next.js application in the current workspace.

```text
Admin browser
    | Supabase email sign-in
    v
admin-web server components and route handlers
    | owner authorization, validated read-only query inputs
    v
dashboard application/query layer
    | server-only Supabase admin client
    v
existing Supabase tables and RPCs
```

`admin-web` depends on the existing shared packages:

- `@showready/contracts` for DTOs, input schemas, and response validation.
- `@showready/application` for dashboard-specific use cases.
- `@showready/infrastructure` for Supabase query implementations and row-to-DTO mapping.
- `@showready/design-system` for shared UI foundations where they are suitable for web.

Next.js remains at the outer edge. Presentation components do not query Supabase directly. The dashboard query layer returns purpose-built, PII-minimized DTOs rather than table rows.

## Authorization and Security

Version 1 is for one person. Authorization uses a single deployment secret:

```text
ADMIN_OWNER_EMAIL=owner@example.com
```

The app uses Supabase email authentication. Every protected page and server route obtains the authenticated user from the server-side Supabase session, normalizes the email, and compares it to `ADMIN_OWNER_EMAIL`. A non-matching or missing user receives an access-denied response; an unauthenticated user is sent to sign-in.

The browser receives neither the Supabase service-role key nor unrestricted database access. After owner authorization, server-only code uses the existing service-role client to read the required data. The existing RLS posture that blocks direct access to analytics, diagnostics, audit, and feedback tables remains unchanged.

All dashboard routes are read-only. Search, date range, page size, and cursor inputs use shared schemas with maximum lengths and bounded ranges. Queries select explicit columns and avoid `select("*")` for dashboard reads.

## Dashboard Pages

### Overview

The home page defaults to the last 30 days and offers 7-, 30-, and 90-day ranges.

It shows:

- Total agent accounts.
- New agent accounts in the selected period.
- Active agent accounts in the last 7 and 30 days, based on `product_events`.
- Selected-period totals for intakes submitted, leads created, and appointments created.
- A daily product-event volume series for the selected period.
- Recent diagnostic and server-error counts, plus the most common error fingerprints or error types.

The overview is intentionally a small operational summary rather than a configurable analytics suite.

### Users

The user list is a searchable, paginated list of ShowReady agent accounts. Each row contains only:

- Full name.
- Email address.
- Brokerage, when available.
- Onboarded/joined date.
- Last product activity time.
- Aggregate counts for leads, submitted intakes, and appointments.

The agent detail page shows:

- The agent profile fields above.
- Selected-period aggregate activity counts.
- Recent first-party product events with event name, time, platform, app version, and route.
- Feedback submitted by that agent.
- Recent diagnostics and server errors associated with that agent, including severity, time, safe error message, screen/route, app version, and fingerprint.

It never returns or displays client/lead PII or content. Activity items must show only sanitized metadata already allowed by the first-party-event design.

### Feedback

The feedback page is a read-only, paginated list of existing `agent_feedback` records. It supports agent name/email search and date filtering. Each item shows:

- Agent name and email.
- Submission time.
- Source.
- Feedback message.
- A link to the agent detail page.

No feedback status or workflow fields are introduced in version 1.

## Existing Data Sources

| Dashboard concern | Existing source | Permitted use |
| --- | --- | --- |
| Account profile and join time | `agents` | Owner-facing agent account summary |
| Account configuration | `agent_settings` | Aggregate/context only; no edit controls |
| Product activity and funnels | `product_events` | Active users, event volume, workflow totals, recent sanitized events |
| Submitted feedback | `agent_feedback` | Read-only feedback review |
| Mobile reliability context | `diagnostic_events` | Counts and sanitized per-agent diagnostic records |
| Backend reliability context | `server_error_events` | Counts and sanitized per-agent/server error records |
| Business-workflow totals | `leads`, `appointments`, existing intake records | Aggregate counts only |
| Audit/compliance context | `audit_events`, `consent_records`, `privacy_requests` | Excluded from v1 UI; retain for a later, explicit compliance scope |

Existing product events already provide a typed event-name catalog such as `intake.submitted`, `lead.created`, and `appointment.created`. The dashboard uses those records; it does not add client tracking merely to render the dashboard.

## Data Flow and Boundaries

1. The owner signs in through the admin web app.
2. The server validates the session and configured owner email.
3. A page or route parses its bounded query inputs.
4. A dashboard use case requests only the DTO it needs through a gateway interface.
5. The Supabase gateway runs explicit server-side reads and maps rows to the DTO.
6. The presenter/component renders safe aggregate data or allowed, sanitized fields.

Dashboard-specific use cases are separate by responsibility:

- `getOverviewMetrics(range)`
- `listAgents(query, page)`
- `getAgentDetail(agentId, range)`
- `listFeedback(query, page)`

Their input/output types belong to the consumer-facing dashboard contracts. Supabase table and RPC details remain inside the infrastructure implementation.

## Error Handling

- Invalid dates, searches, page sizes, and agent IDs return safe validation responses.
- Unauthorized access never reveals whether an account, agent, or dashboard record exists.
- Data-loading failures render a compact retryable state without exposing database messages.
- Server failures continue to use the current server-error observability path, with the dashboard route and the owner ID only when it is safe to record.
- Empty states distinguish “no data in this date range” from loading and failure states.

## Testing

Tests will cover:

- Owner-only access and rejected non-owner or anonymous access.
- Validation of all bounded inputs and pagination cursors.
- Overview metric calculations for each date range and event type.
- Agent listing search, pagination, aggregate counts, and last-activity calculation.
- Agent detail mapping, including no lead/client PII in DTOs or rendered output.
- Feedback list search, date filtering, and linking to agent details.
- Error, empty, and loading states.
- Service-role key safety: no secret is present in client-side code or public environment variables.

## Deployment and Configuration

`admin-web` is deployed separately from `intake-web`, with its own environment variables and a private production hostname such as `admin.showready.app`. It shares the existing Supabase project but uses a separate Supabase auth redirect URL and its own `ADMIN_OWNER_EMAIL` configuration.

The initial deployment is deliberately owner-only and read-only. Introducing support staff, actions, or client-data access requires a new design covering roles, audit requirements, and data-minimization rules.
