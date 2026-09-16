# First-Party Data Collection Design

- Date: 2026-04-29
- Product: ShowReady mobile app and intake web app
- Status: Approved for spec drafting
- Scope: First-party product analytics, audit/compliance events, consent records, privacy data inventory, and retention guidance

## Summary

ShowReady should collect the data needed to operate, improve, and govern the product without adding third-party analytics or advertising SDKs. The selected approach is a first-party data layer: clients send structured events to ShowReady-owned API routes, the backend validates and redacts payloads, and Supabase stores analytics, audit, consent, diagnostics, and business records.

This design extends the current first-party posture already present in the app. The repo currently has Supabase auth, lead/intake persistence, mobile diagnostics, push-token registration, API rate limiting, and server logging. The new work should make product analytics and compliance visibility explicit while preserving a conservative privacy stance.

## Goals

- Collect product usage signals for funnels, retention, workflow quality, and feature adoption.
- Keep analytics first-party in ShowReady infrastructure and avoid third-party behavioral analytics SDKs in v1.
- Add durable audit events for sensitive business and administrative changes.
- Record user consent and privacy-relevant preferences in a queryable format.
- Maintain a data inventory that maps collected data to App Store and Google Play disclosure categories.
- Avoid collecting raw customer content in analytics events.
- Keep diagnostics separate from product analytics so operational debugging and product reporting can have different retention policies.

## Non-Goals

- Adding PostHog, Amplitude, Mixpanel, Segment, Google Analytics, Meta Pixel, Sentry, Firebase Analytics, or other third-party analytics/monitoring SDKs.
- Advertising attribution, retargeting, or cross-app tracking.
- Device fingerprinting.
- Collecting contacts, precise location, camera, microphone, photos, SMS, or call-log data.
- Building a full analytics dashboard in v1.
- Collecting financial documents, identity documents, or proof-of-income files.
- Logging full intake answers, notes, request bodies, response bodies, auth tokens, passwords, or headers in analytics events.

## Selected Approach

ShowReady will implement a first-party event pipeline using the existing Next.js backend and Supabase database.

Clients will never write analytics or audit events directly to Supabase. Mobile and web clients will call backend routes. The backend remains the policy boundary for authentication, schema validation, redaction, rate limiting, and storage.

The first implementation should use append-only database tables and direct SQL/Supabase queries for analysis. If ShowReady later needs a specialized analytics warehouse or vendor, the backend can export sanitized first-party events without changing client instrumentation.

## Current Data Collection Baseline

ShowReady already collects or stores these categories:

- Auth/session data through Supabase Auth, with mobile sessions persisted in SecureStore and web sessions in localStorage where applicable.
- Lead and intake data, including lead contact details, intake drafts, questionnaire answers, scores, recommendations, appointments, showings, and settings.
- Mobile diagnostics, including install-scoped device ID, session ID, app version, build number, platform, screen breadcrumbs, error messages/stacks, API path/status, and related lead or appointment IDs when supplied.
- Push notification tokens, platform, and last seen timestamp after notification permission is granted.
- Rate-limit keys based on IP, token, user, route, and time window.
- Server logs through `console.error` and development-only analytics `console.info`.

The new design should document these existing categories and add structured event collection where the product currently has only business-table mutations.

## Data Categories

### Business Records

Business records are primary product data required to operate ShowReady.

Examples:

- Agents, workspace/account settings, brokerage/license details, notification preferences.
- Invites, intake links, draft payloads, open/submit status, expiration timestamps.
- Leads, contact details, intake type, score, recommendation, summary, stage, status.
- Lead answers and custom question answers.
- Appointments, showings, addresses, dates, notes, and status.

These records can contain personal data and customer content. They should not be copied into product analytics properties unless the field is explicitly non-sensitive.

### Product Events

Product events describe how the app is used. They should be optimized for funnels and operational insight, not detailed record reconstruction.

Initial event names:

- `invite.created`
- `invite.shared`
- `intake.opened`
- `intake.step_viewed`
- `intake.step_completed`
- `intake.autosaved`
- `intake.submitted`
- `lead.created`
- `lead.viewed`
- `lead.reviewed`
- `lead.stage_changed`
- `lead.score_overridden`
- `appointment.created`
- `appointment.updated`
- `settings.updated`
- `notification.permission_requested`
- `notification.token_registered`
- `notification.sent`
- `notification.tapped`

Allowed product-event properties:

- IDs: `agentId`, `workspaceId`, `leadId`, `inviteId`, `appointmentId`.
- Client context: `platform`, `appVersion`, `buildNumber`.
- Funnel context: `source`, `utmSource`, `utmMedium`, `utmCampaign`, `stepKey`, `stepIndex`, `stepCount`, `durationMs`.
- Workflow context: `fromStage`, `toStage`, `recommendation`, `scoreBand`, `appointmentStatus`.
- Notification context: `channel`, `permissionStatus`, `deliveryStatus`, `route`.

Disallowed product-event properties:

- Lead name, email, phone, address, or notes.
- Intake free-text answers.
- Appointment/showing notes.
- Request or response bodies.
- Authorization headers, refresh tokens, push token values, passwords, cookies, or secret keys.

### Audit Events

Audit events are append-only records for accountability. They should capture sensitive changes and actor intent without storing full private content.

Initial audit actions:

- `auth.sign_in`
- `auth.sign_out`
- `auth.failed`
- `invite.created`
- `invite.revoked`
- `lead.stage_changed`
- `lead.reviewed`
- `lead.score_overridden`
- `appointment.created`
- `appointment.updated`
- `appointment.status_changed`
- `settings.updated`
- `notification_preferences.updated`
- `privacy.export_requested`
- `privacy.delete_requested`
- `role.changed` when team roles exist.

Audit records should include:

- `id`
- `occurred_at`
- `actor_id`
- `actor_type`
- `agent_id` or `workspace_id`
- `action`
- `resource_type`
- `resource_id`
- `request_ip`
- `user_agent`
- `platform`
- `app_version`
- `before_summary`
- `after_summary`
- `metadata`

The `before_summary` and `after_summary` fields should store bounded, non-sensitive summaries. For example, a lead stage change can store `{ "fromStage": "new", "toStage": "nurture" }`; it should not store lead notes or intake answers.

### Consent Records

Consent and preference state should be explicit, versioned, and queryable.

Initial consent records:

- Privacy policy acceptance.
- Terms acceptance if terms are introduced.
- Push notification permission state.
- Email notification preference.
- Marketing email consent if marketing communication is introduced.
- Data export/delete request status.

Recommended fields:

- `id`
- `subject_type`
- `subject_id`
- `consent_type`
- `status`
- `policy_version`
- `source`
- `occurred_at`
- `expires_at`
- `metadata`

### Diagnostics

Diagnostics should remain in the existing diagnostics pipeline and table rather than being merged into product analytics. Diagnostics are for reliability and support investigation. Product events are for funnel and behavior reporting.

The diagnostics redaction rules should continue to exclude keys that include email, phone, address, note, notes, token, password, header, headers, body, or response.

## Architecture

### Client Instrumentation

Mobile and web code should use a narrow client API rather than sending arbitrary event payloads from screens.

Suggested public functions:

- `trackProductEvent(name, properties)`
- `trackAuditEvent(action, resource, summary)`
- `recordConsent(type, status, metadata)`

These functions should:

- Attach client context such as platform, app version, build number, and route where available.
- Drop or redact disallowed property keys before transmission.
- Avoid blocking the primary user action.
- Queue briefly when offline only if the event is important enough to keep.

### Server Ingest

The backend should expose first-party routes:

- `POST /api/mobile/events`
- `POST /api/mobile/audit-events`
- `POST /api/mobile/consent-records`
- `POST /api/intake/[token]/events` for limited public intake funnel events.

Server responsibilities:

1. Authenticate mobile routes with the current bearer-token mobile auth flow.
2. Guard public intake routes with the existing token, body-size, honeypot, and rate-limit protections.
3. Validate event names and payload shapes through shared contracts.
4. Apply second-pass redaction on the server.
5. Persist append-only rows.
6. Return a small accepted/rejected response.

### Storage

Recommended tables:

#### `product_events`

- `id uuid primary key`
- `agent_id uuid`
- `workspace_id uuid`
- `actor_id uuid`
- `event_name text not null`
- `resource_type text`
- `resource_id uuid`
- `platform text`
- `app_version text`
- `build_number text`
- `route text`
- `properties jsonb not null default '{}'::jsonb`
- `occurred_at timestamptz not null`
- `received_at timestamptz not null default now()`

Indexes:

- `(agent_id, occurred_at desc)`
- `(event_name, occurred_at desc)`
- `(resource_type, resource_id, occurred_at desc)`

#### `audit_events`

- `id uuid primary key`
- `agent_id uuid`
- `workspace_id uuid`
- `actor_id uuid`
- `actor_type text not null`
- `action text not null`
- `resource_type text not null`
- `resource_id uuid`
- `request_ip text`
- `user_agent text`
- `platform text`
- `app_version text`
- `before_summary jsonb not null default '{}'::jsonb`
- `after_summary jsonb not null default '{}'::jsonb`
- `metadata jsonb not null default '{}'::jsonb`
- `occurred_at timestamptz not null`
- `received_at timestamptz not null default now()`

Indexes:

- `(agent_id, occurred_at desc)`
- `(actor_id, occurred_at desc)`
- `(resource_type, resource_id, occurred_at desc)`
- `(action, occurred_at desc)`

#### `consent_records`

- `id uuid primary key`
- `subject_type text not null`
- `subject_id uuid`
- `agent_id uuid`
- `consent_type text not null`
- `status text not null`
- `policy_version text`
- `source text`
- `metadata jsonb not null default '{}'::jsonb`
- `occurred_at timestamptz not null`
- `expires_at timestamptz`
- `received_at timestamptz not null default now()`

Indexes:

- `(subject_type, subject_id, consent_type, occurred_at desc)`
- `(agent_id, consent_type, occurred_at desc)`

## Data Inventory and Store Disclosures

The app should maintain a checked-in data inventory that maps each data category to:

- Collection source.
- Purpose.
- Whether it is linked to user identity.
- Whether it is shared with third parties.
- Retention period.
- App Store privacy category.
- Google Play Data safety category.

Initial disclosure posture:

- Data is collected for app functionality, analytics, diagnostics, security, and account management.
- Data is linked to the user when associated with agent, lead, invite, device/install ID, or account records.
- Data is not used for third-party advertising or cross-app tracking.
- Data is not shared with data brokers.
- Third-party service exposure is limited to infrastructure and product functionality vendors such as Supabase and Expo push notifications, plus an optional configured lead notification webhook.

Apple guidance says transmitted data that the developer or partners can access beyond real-time request servicing is generally considered collected, even when used only for app functionality. Apple also asks developers to distinguish data linked to users from data used for tracking. Google Play requires disclosure of collection, sharing, and security practices in its Data safety form.

Sources:

- https://developer.apple.com/app-store/app-privacy-details/
- https://support.google.com/googleplay/android-developer/answer/10787469

## Retention

Suggested defaults:

- Product events: 18 months.
- Audit events: 7 years for business-critical changes, unless policy chooses a shorter period.
- Consent records: lifetime of account plus legal retention period.
- Diagnostics: 90 days by default, extendable for active support investigations.
- Intake drafts: expire after invite expiration plus a short cleanup window.
- Rate-limit rows: short-lived, current implementation already deletes old rows after a small grace period.
- Push tokens: delete on sign-out where possible, failed delivery, user opt-out, or inactivity threshold.

Retention should be enforced by scheduled cleanup jobs or database policies, not by manual deletion.

## Privacy and Safety Rules

- Use an allowlist for event names and property keys.
- Treat product analytics as non-content telemetry.
- Keep raw PII in business tables, not analytics tables.
- Keep diagnostics and analytics separate.
- Store external notification webhook payloads only when necessary for debugging, and avoid logging full webhook responses.
- Do not collect location, contacts, camera, microphone, photos, SMS, or call logs without a dedicated feature design and user-facing permission rationale.
- Do not introduce third-party analytics SDKs without revisiting the data inventory, privacy policy, App Store privacy labels, Google Play Data safety form, and vendor contracts.

## Error Handling

- Product event failures must not block user workflows.
- Audit and consent event failures are more important and should be retried or written server-side near the business mutation when possible.
- Public intake event ingestion should be rate-limited and should reject oversized payloads.
- Invalid event properties should be dropped or rejected consistently, with server-side tests covering both paths.

## Testing

Unit tests:

- Shared schemas accept valid product, audit, and consent payloads.
- Shared schemas reject unknown event names, oversized strings, disallowed keys, and invalid resource IDs.
- Redaction removes PII-like keys from nested metadata.
- Event helper functions attach platform/app context without requiring screens to know transport details.

API tests:

- Authenticated mobile event ingestion stores valid events.
- Public intake events are limited to allowed event names and properties.
- Rate limits apply to public intake event routes.
- Audit events are written for lead stage changes, score overrides, appointment mutations, and settings changes.
- Consent records are written for notification and email preference changes.

End-to-end checks:

- Invite creation through intake submission produces expected product events.
- Lead review and stage movement produce both product and audit events.
- Notification permission and token registration produce consent/product events without storing token values in analytics.

## Implementation Sequence

1. Add shared event contracts and redaction utilities.
2. Add Supabase SQL for `product_events`, `audit_events`, and `consent_records`.
3. Add backend data-layer write functions and API routes.
4. Add client event helpers for mobile and web.
5. Instrument the highest-value flows: invite, intake funnel, lead review/stage movement, appointments, settings, notifications.
6. Add audit writes server-side beside business mutations.
7. Add consent writes for notification and email preference changes.
8. Add data inventory documentation for store disclosures and privacy policy updates.
9. Add retention cleanup scripts or scheduled jobs.

## Open Questions

- What retention period should ShowReady choose for audit events: 3 years, 7 years, or account lifetime plus a deletion window?
- Should public intake funnel events be recorded before a lead exists, keyed only by invite token hash, or only after the invite is converted into a lead?
- Should the optional notification webhook be treated as an approved third-party processor in the privacy inventory, or should it be removed before launch?
- Does ShowReady need account/team workspaces soon? If yes, the event schema should include `workspace_id` from the start even if it is nullable at first.
