# Universal Lead CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a submitted-leads-only CSV export from mobile Settings with an inclusive calendar date range.

**Architecture:** The backend owns authorization, date validation, lead loading, audit logging, and CSV generation. A pure CSV formatter maps `Lead` objects into a stable universal CRM-friendly header, while mobile Settings calls the export endpoint and shares the returned file.

**Tech Stack:** Next.js route handlers, Supabase data layer, shared TypeScript contracts, Expo React Native, `@react-native-community/datetimepicker`, Expo file/share APIs, Vitest, Jest.

---

## Files

- Create `apps/intake-web/lib/leads/export-csv.ts` for pure CSV mapping and escaping.
- Create `apps/intake-web/lib/leads/export-csv.test.ts` for formatter tests.
- Modify `apps/intake-web/lib/supabase/data.ts` to load submitted leads with answer rows for a date range.
- Create `apps/intake-web/app/api/mobile/leads/export.csv/route.ts` for the authenticated CSV endpoint.
- Create `apps/intake-web/app/api/mobile/leads/export.csv/route.test.ts` for validation, response, and audit tests.
- Modify `packages/contracts/src/index.ts` with a query schema for `from`, `to`, and optional `timeZone`.
- Modify `packages/infrastructure/src/mobile-api.ts` to add `exportLeadsCsv`.
- Modify `packages/infrastructure/tests/mobile-api.test.ts` for the new client method.
- Create `apps/agent-mobile/lib/share-csv.ts` for writing and sharing a CSV file.
- Modify `apps/agent-mobile/app/(app)/settings.tsx` to add the export card and bottom sheet.
- Modify `apps/agent-mobile/tests/settings-screen.test.tsx` for export UI behavior.
- Modify `apps/agent-mobile/package.json` and `pnpm-lock.yaml` for Expo file/share dependencies if they are not already available.

## Tasks

### Task 1: CSV Formatter

- [ ] Write failing formatter tests for stable headers, buyer/rental mapping, CSV escaping, tags, and notes.
- [ ] Run `corepack pnpm --filter @showready/intake-web test -- lib/leads/export-csv.test.ts` and verify failure because the module does not exist.
- [ ] Implement `buildLeadExportCsv` and supporting helpers in `apps/intake-web/lib/leads/export-csv.ts`.
- [ ] Re-run the formatter tests and verify they pass.

### Task 2: Backend Data Loader and Route

- [ ] Write failing route tests for valid export, missing/invalid date handling, reversed ranges, submitted-only scope, and audit logging.
- [ ] Run the new route test and verify failure because the route does not exist.
- [ ] Add `LeadExportQuerySchema` in `packages/contracts/src/index.ts`.
- [ ] Add `listSubmittedLeadsForCsvExport` in `apps/intake-web/lib/supabase/data.ts`.
- [ ] Add `apps/intake-web/app/api/mobile/leads/export.csv/route.ts`.
- [ ] Re-run route tests and contract type checks.

### Task 3: Mobile API Client

- [ ] Write a failing `packages/infrastructure/tests/mobile-api.test.ts` case for `exportLeadsCsv`.
- [ ] Run `corepack pnpm --filter @showready/infrastructure test -- mobile-api.test.ts` and verify failure because the method does not exist.
- [ ] Implement `exportLeadsCsv` in `packages/infrastructure/src/mobile-api.ts`.
- [ ] Re-run infrastructure tests.

### Task 4: Mobile Share Helper and Settings UI

- [ ] Add Expo file/share dependencies if needed.
- [ ] Write failing Settings tests for the export card, date range validation, date picker interaction, and successful API/share call.
- [ ] Run `corepack pnpm --filter @showready/agent-mobile test -- settings-screen.test.tsx` and verify failures.
- [ ] Implement `apps/agent-mobile/lib/share-csv.ts`.
- [ ] Update Settings with the export card, bottom sheet, date pickers, and share flow.
- [ ] Re-run Settings tests.

### Task 5: Verification

- [ ] Run focused tests for intake-web, infrastructure, and agent-mobile changed areas.
- [ ] Run `corepack pnpm --filter @showready/intake-web typecheck`.
- [ ] Run `corepack pnpm --filter @showready/infrastructure typecheck`.
- [ ] Run `corepack pnpm --filter @showready/agent-mobile typecheck`.
- [ ] Review `git diff` for unrelated churn.
