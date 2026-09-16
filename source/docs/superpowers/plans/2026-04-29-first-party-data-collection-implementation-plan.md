# First-Party Data Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-party event layer for product analytics, audit events, and consent records without adding third-party analytics SDKs.

**Architecture:** Shared Zod contracts define allowed event names, payloads, and response shapes. Next.js route handlers authenticate/rate-limit requests, apply server-side redaction, and persist append-only rows in Supabase through `apps/intake-web/lib/supabase/data.ts`. Mobile infrastructure exposes typed methods so app code can send events through the existing authenticated API client.

**Tech Stack:** TypeScript, Zod, Next.js App Router route handlers, Supabase/Postgres SQL, Vitest, React Native/Expo mobile API client.

---

### Task 1: Shared Event Contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/tests/events.test.ts`

- [ ] **Step 1: Write failing tests** for product, audit, and consent payload parsing, including rejection of disallowed event names and oversized metadata.
- [ ] **Step 2: Run** `pnpm --filter @showready/contracts test -- events.test.ts` and confirm the new tests fail because schemas do not exist.
- [ ] **Step 3: Implement contracts** for product events, audit events, consent records, and common event metadata.
- [ ] **Step 4: Re-run contracts tests** and confirm they pass.

### Task 2: Database SQL and Persistence Functions

**Files:**
- Create: `apps/intake-web/lib/supabase/sql/2026-04-29-first-party-events.sql`
- Modify: `apps/intake-web/lib/supabase/data.ts`
- Create or modify tests near existing data-layer tests if a practical local mock exists.

- [ ] **Step 1: Write failing persistence tests** for row mapping if current test harness supports it.
- [ ] **Step 2: Add SQL tables** for `product_events`, `audit_events`, and `consent_records` using `timestamptz`, `jsonb`, foreign-key indexes, and query indexes.
- [ ] **Step 3: Add data-layer functions** `recordProductEvents`, `recordAuditEvents`, and `recordConsentRecords`.
- [ ] **Step 4: Re-run targeted tests** and typecheck affected packages.

### Task 3: Authenticated Mobile Event APIs

**Files:**
- Create: `apps/intake-web/app/api/mobile/events/route.ts`
- Create: `apps/intake-web/app/api/mobile/events/route.test.ts`
- Create: `apps/intake-web/app/api/mobile/audit-events/route.ts`
- Create: `apps/intake-web/app/api/mobile/audit-events/route.test.ts`
- Create: `apps/intake-web/app/api/mobile/consent-records/route.ts`
- Create: `apps/intake-web/app/api/mobile/consent-records/route.test.ts`

- [ ] **Step 1: Write failing route tests** for auth, validation, redaction, and persistence calls.
- [ ] **Step 2: Run targeted route tests** and confirm they fail because routes do not exist.
- [ ] **Step 3: Implement route handlers** using `requireMobileAgent`, shared schemas, second-pass redaction, and data-layer writes.
- [ ] **Step 4: Re-run targeted route tests** and confirm they pass.

### Task 4: Mobile API Client Methods

**Files:**
- Modify: `packages/infrastructure/src/mobile-api.ts`
- Modify: `packages/infrastructure/tests/mobile-api.test.ts`

- [ ] **Step 1: Write failing tests** for `submitProductEvents`, `submitAuditEvents`, and `submitConsentRecords`.
- [ ] **Step 2: Run infrastructure tests** and confirm failures.
- [ ] **Step 3: Implement mobile API methods** using authenticated `POST` requests and shared response schemas.
- [ ] **Step 4: Re-run infrastructure tests** and confirm they pass.

### Task 5: Initial Instrumentation

**Files:**
- Modify: `apps/agent-mobile/providers/session-provider.tsx`
- Modify: `apps/intake-web/app/api/intake/[token]/submit/route.ts`
- Modify related tests.

- [ ] **Step 1: Write failing tests** for notification token registration and intake submission event recording.
- [ ] **Step 2: Implement minimal instrumentation** for notification permission/token registration and intake submission without blocking user workflows.
- [ ] **Step 3: Re-run targeted tests** and confirm they pass.

### Task 6: Verification

- [ ] **Step 1: Run contracts tests.**
- [ ] **Step 2: Run infrastructure tests.**
- [ ] **Step 3: Run intake-web targeted API tests.**
- [ ] **Step 4: Run mobile targeted provider tests if instrumentation touched mobile behavior.**
- [ ] **Step 5: Run typechecks for affected workspaces if time allows.**
