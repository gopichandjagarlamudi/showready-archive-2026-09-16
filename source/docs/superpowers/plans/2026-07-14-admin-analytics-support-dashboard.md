# Admin Analytics and Support Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, owner-only, read-only ShowReady web dashboard that shows existing first-party analytics, agent accounts, submitted feedback, and safe diagnostic context.

**Architecture:** Add `apps/admin-web` as an independently deployable Next.js app. It authenticates the configured owner with Supabase email authentication, authorizes every protected server render, and uses a server-only dashboard gateway. Four service-role-only Supabase RPC functions return purpose-built, PII-minimized JSON DTOs; shared contracts validate those DTOs before the UI renders them.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Vitest, Zod 4, Supabase Auth SSR, Supabase Postgres RPC, pnpm workspaces.

---

## File map

| Path | Responsibility |
| --- | --- |
| `apps/admin-web/` | New private Next.js admin application and its tests. |
| `apps/admin-web/lib/auth.ts` | Owner session and allow-list authorization. |
| `apps/admin-web/lib/dashboard.ts` | Server-only composition root for dashboard use cases. |
| `apps/admin-web/lib/query.ts` | Canonical, bounded URL-query parsing and opaque pagination cursors. |
| `apps/admin-web/lib/supabase/*` | Browser, server-session, service-role, and environment-specific Supabase clients. |
| `apps/admin-web/lib/observability.ts` | Safe persistence of admin-app server errors in `server_error_events`. |
| `apps/admin-web/app/(owner)/*` | Protected overview, users, user detail, and feedback pages. |
| `apps/admin-web/components/*` | Small presentational components with no Supabase access. |
| `packages/contracts/src/admin-dashboard.ts` | Strict request and response contracts for the dashboard. |
| `packages/application/src/{ports,use-cases}.ts` | Dashboard gateway port and read-only use cases. |
| `packages/infrastructure/src/admin-dashboard.ts` | Supabase RPC adapter that maps RPC JSON to strict contracts. |
| `apps/intake-web/lib/supabase/sql/2026-07-14-admin-dashboard.sql` | Service-role-only aggregate/read RPCs and supporting indexes. |

## Data rules locked in by this plan

- “Active agent” means an agent with a persisted `product_events` record. The UI labels it **Tracked active agents** because existing event coverage is intentionally partial.
- “Intakes submitted,” “leads created,” and “appointments created” come from existing business records (`leads.submitted_at`, `leads.created_at`, and `appointments.created_at`), not inferred from missing analytics events.
- The admin UI never receives lead/client rows or fields. No `buyer_name`, `buyer_email`, `buyer_phone`, address, notes, intake answers, diagnostic `context`, diagnostic `breadcrumbs`, server-error `stack`, or server-error `query_keys` may appear in dashboard contracts or RPC output.
- The only full-text user content in v1 is the agent’s own `agent_feedback.message`, as explicitly approved.
- All reads use a service-role server client only after owner authorization. The browser gets only the Supabase URL and anon/publishable key.

### Task 1: Add strict dashboard contracts and bounded query primitives

**Files:**

- Create: `packages/contracts/src/admin-dashboard.ts`
- Modify: `packages/contracts/src/index.ts`
- Create: `packages/contracts/tests/admin-dashboard.test.ts`

- [ ] **Step 1: Write failing contract tests for accepted ranges, safe DTOs, and invalid inputs.**

```ts
// packages/contracts/tests/admin-dashboard.test.ts
import { describe, expect, it } from "vitest"
import {
  AdminAgentDetailSchema,
  AdminDashboardRangeDaysSchema,
  AdminFeedbackListQuerySchema
} from "../src/admin-dashboard"

describe("admin dashboard contracts", () => {
  it("accepts only the supported dashboard date ranges", () => {
    expect(AdminDashboardRangeDaysSchema.parse(7)).toBe(7)
    expect(AdminDashboardRangeDaysSchema.parse(30)).toBe(30)
    expect(AdminDashboardRangeDaysSchema.parse(90)).toBe(90)
    expect(() => AdminDashboardRangeDaysSchema.parse(14)).toThrow()
  })

  it("bounds feedback search and pagination", () => {
    expect(
      AdminFeedbackListQuerySchema.parse({
        query: "Morgan",
        rangeDays: 30,
        offset: 25
      })
    ).toMatchObject({ query: "Morgan", rangeDays: 30, offset: 25, pageSize: 25 })

    expect(() =>
      AdminFeedbackListQuerySchema.parse({ query: "x".repeat(101), rangeDays: 30 })
    ).toThrow()
  })

  it("rejects agent detail payloads that contain lead or client data", () => {
    expect(() =>
      AdminAgentDetailSchema.parse({
        profile: {
          id: "00000000-0000-4000-8000-000000000001",
          fullName: "Morgan",
          email: "morgan@example.com",
          brokerage: null,
          joinedAt: null,
          lastTrackedActivityAt: null
        },
        aggregates: { leadCount: 4, submittedIntakeCount: 3, appointmentCount: 1 },
        recentEvents: [],
        feedback: [],
        diagnostics: [],
        serverErrors: [],
        buyerName: "Must not cross the boundary"
      })
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run the new contract test to verify it fails.**

Run: `corepack pnpm --filter @showready/contracts exec vitest run tests/admin-dashboard.test.ts`

Expected: FAIL because `admin-dashboard.ts` does not exist.

- [ ] **Step 3: Define strict public dashboard schemas and export them.**

Create `packages/contracts/src/admin-dashboard.ts`. Use `z.strictObject` for every DTO so a future RPC addition containing forbidden fields fails closed instead of being silently passed to the UI. Implement these exact shapes:

```ts
import { z } from "zod"

const IsoDateTimeSchema = z.string().datetime()
const NullableIsoDateTimeSchema = IsoDateTimeSchema.nullable()
const UuidSchema = z.string().uuid()

export const AdminDashboardRangeDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90)])
export type AdminDashboardRangeDays = z.infer<typeof AdminDashboardRangeDaysSchema>

export const AdminCursorPayloadSchema = z.strictObject({
  offset: z.number().int().min(0).max(5000)
})
export type AdminCursorPayload = z.infer<typeof AdminCursorPayloadSchema>

export const AdminPageSizeSchema = z.union([z.literal(25), z.literal(50)])

const AdminListQueryShape = {
  query: z.string().trim().max(100).default(""),
  rangeDays: AdminDashboardRangeDaysSchema.default(30),
  offset: z.number().int().min(0).max(5000).default(0),
  pageSize: AdminPageSizeSchema.default(25)
}

export const AdminAgentListQuerySchema = z.strictObject(AdminListQueryShape)
export const AdminFeedbackListQuerySchema = z.strictObject(AdminListQueryShape)
export type AdminAgentListQuery = z.infer<typeof AdminAgentListQuerySchema>
export type AdminFeedbackListQuery = z.infer<typeof AdminFeedbackListQuerySchema>

export const AdminMetricSchema = z.strictObject({
  label: z.string().min(1).max(80),
  value: z.number().int().nonnegative(),
  helpText: z.string().min(1).max(160)
})

export const AdminDailyEventVolumeSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  count: z.number().int().nonnegative()
})

export const AdminErrorGroupSchema = z.strictObject({
  source: z.enum(["diagnostic", "server"]),
  label: z.string().min(1).max(256),
  count: z.number().int().positive()
})

export const AdminDashboardOverviewSchema = z.strictObject({
  rangeDays: AdminDashboardRangeDaysSchema,
  metrics: z.array(AdminMetricSchema).length(8),
  dailyEventVolume: z.array(AdminDailyEventVolumeSchema),
  errorGroups: z.array(AdminErrorGroupSchema).max(5)
})
export type AdminDashboardOverview = z.infer<typeof AdminDashboardOverviewSchema>

export const AdminAgentListItemSchema = z.strictObject({
  id: UuidSchema,
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  brokerage: z.string().max(200).nullable(),
  joinedAt: NullableIsoDateTimeSchema,
  lastTrackedActivityAt: NullableIsoDateTimeSchema,
  leadCount: z.number().int().nonnegative(),
  submittedIntakeCount: z.number().int().nonnegative(),
  appointmentCount: z.number().int().nonnegative()
})

export const AdminAgentListSchema = z.strictObject({
  items: z.array(AdminAgentListItemSchema),
  total: z.number().int().nonnegative()
})
export type AdminAgentList = z.infer<typeof AdminAgentListSchema>

export const AdminFeedbackItemSchema = z.strictObject({
  id: UuidSchema,
  agentId: UuidSchema,
  agentFullName: z.string().min(1).max(200),
  agentEmail: z.string().email(),
  source: z.string().min(1).max(80),
  message: z.string().min(1).max(4000),
  createdAt: IsoDateTimeSchema
})

export const AdminFeedbackListSchema = z.strictObject({
  items: z.array(AdminFeedbackItemSchema),
  total: z.number().int().nonnegative()
})
export type AdminFeedbackList = z.infer<typeof AdminFeedbackListSchema>

export const AdminAgentDetailSchema = z.strictObject({
  profile: z.strictObject({
    id: UuidSchema,
    fullName: z.string().min(1).max(200),
    email: z.string().email(),
    brokerage: z.string().max(200).nullable(),
    joinedAt: NullableIsoDateTimeSchema,
    lastTrackedActivityAt: NullableIsoDateTimeSchema
  }),
  aggregates: z.strictObject({
    leadCount: z.number().int().nonnegative(),
    submittedIntakeCount: z.number().int().nonnegative(),
    appointmentCount: z.number().int().nonnegative()
  }),
  recentEvents: z.array(z.strictObject({
    eventName: z.string().min(1).max(80),
    occurredAt: IsoDateTimeSchema,
    platform: z.string().min(1).max(32).nullable(),
    appVersion: z.string().max(64).nullable(),
    route: z.string().max(160).nullable()
  })).max(20),
  feedback: z.array(z.strictObject({
    id: UuidSchema,
    source: z.string().min(1).max(80),
    message: z.string().min(1).max(4000),
    createdAt: IsoDateTimeSchema
  })).max(20),
  diagnostics: z.array(z.strictObject({
    id: UuidSchema,
    severity: z.enum(["debug", "info", "warning", "error", "fatal"]),
    message: z.string().min(1).max(2000),
    fingerprint: z.string().max(256).nullable(),
    screen: z.string().max(160).nullable(),
    requestPath: z.string().max(160).nullable(),
    appVersion: z.string().max(64).nullable(),
    occurredAt: IsoDateTimeSchema
  })).max(20),
  serverErrors: z.array(z.strictObject({
    id: UuidSchema,
    errorType: z.string().min(1).max(120),
    message: z.string().min(1).max(2000),
    route: z.string().min(1).max(160),
    path: z.string().min(1).max(240),
    status: z.number().int().min(0).max(599),
    occurredAt: IsoDateTimeSchema
  })).max(20)
})
export type AdminAgentDetail = z.infer<typeof AdminAgentDetailSchema>
```

Append `export * from "./admin-dashboard"` to `packages/contracts/src/index.ts`.

- [ ] **Step 4: Run the contract test to verify it passes.**

Run: `corepack pnpm --filter @showready/contracts exec vitest run tests/admin-dashboard.test.ts`

Expected: PASS with three tests.

- [ ] **Step 5: Commit the contracts.**

```bash
git add packages/contracts/src/admin-dashboard.ts packages/contracts/src/index.ts packages/contracts/tests/admin-dashboard.test.ts
git commit -m "feat: add admin dashboard contracts"
```

### Task 2: Add dashboard application ports and read-only use cases

**Files:**

- Modify: `packages/application/src/ports.ts`
- Modify: `packages/application/src/use-cases.ts`
- Modify: `packages/application/tests/use-cases.test.ts`

- [ ] **Step 1: Add failing use-case tests that prove each dashboard read delegates only to its gateway method.**

Add this test block to `packages/application/tests/use-cases.test.ts`:

```ts
import {
  getAdminAgentDetail,
  getAdminDashboardOverview,
  listAdminAgents,
  listAdminFeedback
} from "../src/use-cases"

it("loads all admin dashboard reads through the admin gateway", async () => {
  const gateway = {
    getOverview: vi.fn(async () => ({ rangeDays: 30, metrics: [], dailyEventVolume: [], errorGroups: [] })),
    listAgents: vi.fn(async () => ({ items: [], total: 0 })),
    getAgentDetail: vi.fn(async () => null),
    listFeedback: vi.fn(async () => ({ items: [], total: 0 }))
  }

  await getAdminDashboardOverview(gateway, 30)
  await listAdminAgents(gateway, { query: "Morgan", rangeDays: 30, offset: 0, pageSize: 25 })
  await getAdminAgentDetail(gateway, "00000000-0000-4000-8000-000000000001", 30)
  await listAdminFeedback(gateway, { query: "", rangeDays: 7, offset: 0, pageSize: 25 })

  expect(gateway.getOverview).toHaveBeenCalledWith(30)
  expect(gateway.listAgents).toHaveBeenCalledWith({ query: "Morgan", rangeDays: 30, offset: 0, pageSize: 25 })
  expect(gateway.getAgentDetail).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", 30)
  expect(gateway.listFeedback).toHaveBeenCalledWith({ query: "", rangeDays: 7, offset: 0, pageSize: 25 })
})
```

- [ ] **Step 2: Run the application test to verify it fails.**

Run: `corepack pnpm --filter @showready/application exec vitest run tests/use-cases.test.ts`

Expected: FAIL because the dashboard functions and gateway methods do not exist.

- [ ] **Step 3: Add the dashboard gateway port and four thin use cases.**

Add this port to `packages/application/src/ports.ts`:

```ts
import type {
  AdminAgentDetail,
  AdminAgentList,
  AdminAgentListQuery,
  AdminDashboardOverview,
  AdminDashboardRangeDays,
  AdminFeedbackList,
  AdminFeedbackListQuery
} from "@showready/contracts"

export type AdminDashboardGateway = {
  getOverview(rangeDays: AdminDashboardRangeDays): Promise<AdminDashboardOverview>
  listAgents(input: AdminAgentListQuery): Promise<AdminAgentList>
  getAgentDetail(agentId: string, rangeDays: AdminDashboardRangeDays): Promise<AdminAgentDetail | null>
  listFeedback(input: AdminFeedbackListQuery): Promise<AdminFeedbackList>
}
```

Add these functions to `packages/application/src/use-cases.ts`; they intentionally have no database, framework, or presentation logic:

```ts
export async function getAdminDashboardOverview(
  gateway: Pick<AdminDashboardGateway, "getOverview">,
  rangeDays: AdminDashboardRangeDays
) {
  return gateway.getOverview(rangeDays)
}

export async function listAdminAgents(
  gateway: Pick<AdminDashboardGateway, "listAgents">,
  input: AdminAgentListQuery
) {
  return gateway.listAgents(input)
}

export async function getAdminAgentDetail(
  gateway: Pick<AdminDashboardGateway, "getAgentDetail">,
  agentId: string,
  rangeDays: AdminDashboardRangeDays
) {
  return gateway.getAgentDetail(agentId, rangeDays)
}

export async function listAdminFeedback(
  gateway: Pick<AdminDashboardGateway, "listFeedback">,
  input: AdminFeedbackListQuery
) {
  return gateway.listFeedback(input)
}
```

- [ ] **Step 4: Run the application test to verify it passes.**

Run: `corepack pnpm --filter @showready/application exec vitest run tests/use-cases.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the application boundary.**

```bash
git add packages/application/src/ports.ts packages/application/src/use-cases.ts packages/application/tests/use-cases.test.ts
git commit -m "feat: add admin dashboard use cases"
```

### Task 3: Add service-role-only dashboard RPCs and read indexes

**Files:**

- Create: `apps/intake-web/lib/supabase/sql/2026-07-14-admin-dashboard.sql`
- Modify: `apps/intake-web/lib/supabase/sql/scale-hardening-sql.test.ts`

- [ ] **Step 1: Add failing SQL migration assertions.**

Append the following test to `apps/intake-web/lib/supabase/sql/scale-hardening-sql.test.ts`:

```ts
it("keeps admin dashboard RPCs private and excludes lead/client payload columns", () => {
  const sql = readFileSync(
    new URL("./2026-07-14-admin-dashboard.sql", import.meta.url),
    "utf8"
  )

  expect(sql).toContain("create or replace function public.get_admin_dashboard_overview")
  expect(sql).toContain("create or replace function public.list_admin_agents")
  expect(sql).toContain("create or replace function public.get_admin_agent_detail")
  expect(sql).toContain("create or replace function public.list_admin_feedback")
  expect(sql).toContain("grant execute on function public.get_admin_dashboard_overview(integer) to service_role")
  expect(sql).toContain("revoke all on function public.get_admin_dashboard_overview(integer) from public, anon, authenticated")
  expect(sql).not.toContain("buyer_name")
  expect(sql).not.toContain("buyer_email")
  expect(sql).not.toContain("buyer_phone")
  expect(sql).not.toContain("breadcrumbs")
  expect(sql).not.toContain("stack")
})
```

- [ ] **Step 2: Run the SQL migration tests to verify they fail.**

Run: `corepack pnpm --filter @showready/intake-web exec vitest run lib/supabase/sql/scale-hardening-sql.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Create the read indexes and four JSONB-returning RPC functions.**

Create `apps/intake-web/lib/supabase/sql/2026-07-14-admin-dashboard.sql` with these invariants:

```sql
create index if not exists product_events_occurred_agent_idx
  on public.product_events (occurred_at desc, agent_id);

create index if not exists leads_created_at_idx
  on public.leads (created_at desc);

create index if not exists leads_submitted_at_idx
  on public.leads (submitted_at desc)
  where submitted_at is not null;

create index if not exists appointments_created_at_idx
  on public.appointments (created_at desc);
```

Implement `public.get_admin_dashboard_overview(p_range_days integer) returns jsonb` as a `stable security definer` function with `set search_path = public`. Reject a range other than `7`, `30`, or `90`. It must return this exact camel-case JSON shape:

```sql
jsonb_build_object(
  'rangeDays', p_range_days,
  'metrics', jsonb_build_array(
    jsonb_build_object('label', 'Total agents', 'value', total_agents, 'helpText', 'All ShowReady agent accounts'),
    jsonb_build_object('label', 'New agents', 'value', new_agents, 'helpText', 'Accounts onboarded in the selected period'),
    jsonb_build_object('label', 'Tracked active agents (7d)', 'value', active_agents_7d, 'helpText', 'Agents with a persisted product event in the last 7 days'),
    jsonb_build_object('label', 'Tracked active agents (30d)', 'value', active_agents_30d, 'helpText', 'Agents with a persisted product event in the last 30 days'),
    jsonb_build_object('label', 'Intakes submitted', 'value', submitted_intakes, 'helpText', 'Lead records submitted in the selected period'),
    jsonb_build_object('label', 'Leads created', 'value', created_leads, 'helpText', 'Lead records created in the selected period'),
    jsonb_build_object('label', 'Appointments created', 'value', created_appointments, 'helpText', 'Appointment records created in the selected period'),
    jsonb_build_object('label', 'Recorded errors', 'value', recorded_errors, 'helpText', 'Diagnostic errors and server errors in the selected period')
  ),
  'dailyEventVolume', daily_event_volume,
  'errorGroups', error_groups
)
```

Calculate `submitted_intakes` from `leads.submitted_at`, `created_leads` from `leads.created_at`, and `created_appointments` from `appointments.created_at`. Calculate active-agent counts with `count(distinct product_events.agent_id)` for 7 and 30 days. Generate daily product-event rows from `product_events.occurred_at`; event dates with no rows are omitted rather than fabricated. Build error groups only from `diagnostic_events.fingerprint` and `server_error_events.error_type`; never include a diagnostic message or server-error message in overview error-group labels.

Implement the remaining three functions with the listed parameter and return shapes:

```sql
create or replace function public.list_admin_agents(
  p_query text,
  p_limit integer,
  p_offset integer
) returns jsonb;

create or replace function public.get_admin_agent_detail(
  p_agent_id uuid,
  p_range_days integer
) returns jsonb;

create or replace function public.list_admin_feedback(
  p_query text,
  p_range_days integer,
  p_limit integer,
  p_offset integer
) returns jsonb;
```

`list_admin_agents` searches only `agents.full_name`, `agents.email`, and `agents.brokerage`, orders by `lastTrackedActivityAt desc nulls last`, then `fullName`, then `id`, and returns:

```sql
jsonb_build_object(
  'items', coalesce(items, '[]'::jsonb),
  'total', total_count
)
```

Each item must contain only `id`, `fullName`, `email`, `brokerage`, `joinedAt` (from `agents.onboarded_at`), `lastTrackedActivityAt` (the latest `product_events.occurred_at`), `leadCount`, `submittedIntakeCount`, and `appointmentCount`. Use correlated aggregate subqueries or pre-aggregated CTEs so joins never multiply the three counts.

`get_admin_agent_detail` returns `null` when the agent does not exist. Otherwise, return exactly `profile`, `aggregates`, `recentEvents`, `feedback`, `diagnostics`, and `serverErrors` as defined by `AdminAgentDetailSchema`. Limit every activity array to 20 rows. Select only these support columns:

```sql
-- recentEvents: event_name, occurred_at, platform, app_version, route
-- diagnostics: id, severity, message, fingerprint, screen, request_path, app_version, occurred_at
-- serverErrors: id, error_type, message, route, path, status, occurred_at
```

`list_admin_feedback` filters `agent_feedback.created_at` to the selected period, searches only agent full name/email, and returns the columns in `AdminFeedbackItemSchema` plus `total`. It sorts newest first, then `agent_feedback.id` descending.

After every function declaration, lock it to service role with this exact pattern, substituting the function name and signature:

```sql
revoke all on function public.get_admin_dashboard_overview(integer) from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_overview(integer) to service_role;
```

Apply the same `revoke`/`grant` pattern to the three list/detail functions. Do not grant these functions to `authenticated`.

- [ ] **Step 4: Run the SQL migration tests to verify they pass.**

Run: `corepack pnpm --filter @showready/intake-web exec vitest run lib/supabase/sql/scale-hardening-sql.test.ts`

Expected: PASS.

- [ ] **Step 5: Apply the migration to the intended Supabase project and verify function privileges.**

Run the complete contents of `apps/intake-web/lib/supabase/sql/2026-07-14-admin-dashboard.sql` once through the project’s established Supabase SQL migration process. Then run:

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_admin_dashboard_overview',
    'list_admin_agents',
    'get_admin_agent_detail',
    'list_admin_feedback'
  )
order by routine_name, grantee;
```

Expected: each dashboard routine is executable by `service_role`; `anon`, `authenticated`, and `public` have no execute privilege.

- [ ] **Step 6: Commit the database read layer.**

```bash
git add apps/intake-web/lib/supabase/sql/2026-07-14-admin-dashboard.sql apps/intake-web/lib/supabase/sql/scale-hardening-sql.test.ts
git commit -m "feat: add private admin dashboard queries"
```

### Task 4: Implement the Supabase dashboard gateway

**Files:**

- Create: `packages/infrastructure/src/admin-dashboard.ts`
- Modify: `packages/infrastructure/src/index.ts`
- Modify: `packages/infrastructure/package.json`
- Create: `packages/infrastructure/tests/admin-dashboard.test.ts`

- [ ] **Step 1: Write failing gateway tests for RPC parameter mapping and fail-closed DTO parsing.**

```ts
// packages/infrastructure/tests/admin-dashboard.test.ts
import { describe, expect, it, vi } from "vitest"
import { createAdminDashboardGateway } from "../src/admin-dashboard"

it("uses the overview RPC and parses the strict response", async () => {
  const rpc = vi.fn(async () => ({
    data: {
      rangeDays: 30,
      metrics: Array.from({ length: 8 }, () => ({ label: "Metric", value: 0, helpText: "Help" })),
      dailyEventVolume: [],
      errorGroups: []
    },
    error: null
  }))
  const gateway = createAdminDashboardGateway({ rpc } as never)

  await gateway.getOverview(30)

  expect(rpc).toHaveBeenCalledWith("get_admin_dashboard_overview", { p_range_days: 30 })
})

it("rejects a detail RPC response with forbidden client data", async () => {
  const rpc = vi.fn(async () => ({
    data: {
      profile: { id: "00000000-0000-4000-8000-000000000001", fullName: "Morgan", email: "morgan@example.com", brokerage: null, joinedAt: null, lastTrackedActivityAt: null },
      aggregates: { leadCount: 0, submittedIntakeCount: 0, appointmentCount: 0 },
      recentEvents: [], feedback: [], diagnostics: [], serverErrors: [], buyerEmail: "client@example.com"
    },
    error: null
  }))
  const gateway = createAdminDashboardGateway({ rpc } as never)

  await expect(gateway.getAgentDetail("00000000-0000-4000-8000-000000000001", 30)).rejects.toThrow()
})
```

- [ ] **Step 2: Run the gateway test to verify it fails.**

Run: `corepack pnpm --filter @showready/infrastructure exec vitest run tests/admin-dashboard.test.ts`

Expected: FAIL because the gateway module does not exist.

- [ ] **Step 3: Implement `createAdminDashboardGateway` with only service-side RPC calls.**

Create `packages/infrastructure/src/admin-dashboard.ts` with the following implementation pattern. Each method must throw the Supabase error before parsing and must parse the returned JSON with the matching strict schema.

```ts
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AdminAgentDetailSchema,
  AdminAgentListSchema,
  AdminDashboardOverviewSchema,
  AdminFeedbackListSchema,
  type AdminAgentListQuery,
  type AdminDashboardRangeDays,
  type AdminFeedbackListQuery
} from "@showready/contracts"
import type { AdminDashboardGateway } from "@showready/application"

async function getRpcJson<T>(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
  parse: (value: unknown) => T
) {
  const { data, error } = await client.rpc(name, args)
  if (error) throw error
  return parse(data)
}

export function createAdminDashboardGateway(client: SupabaseClient): AdminDashboardGateway {
  return {
    getOverview(rangeDays: AdminDashboardRangeDays) {
      return getRpcJson(client, "get_admin_dashboard_overview", { p_range_days: rangeDays }, (data) =>
        AdminDashboardOverviewSchema.parse(data)
      )
    },
    listAgents(input: AdminAgentListQuery) {
      return getRpcJson(client, "list_admin_agents", {
        p_query: input.query,
        p_limit: input.pageSize,
        p_offset: input.offset
      }, (data) => AdminAgentListSchema.parse(data))
    },
    getAgentDetail(agentId: string, rangeDays: AdminDashboardRangeDays) {
      return getRpcJson(client, "get_admin_agent_detail", {
        p_agent_id: agentId,
        p_range_days: rangeDays
      }, (data) => data === null ? null : AdminAgentDetailSchema.parse(data))
    },
    listFeedback(input: AdminFeedbackListQuery) {
      return getRpcJson(client, "list_admin_feedback", {
        p_query: input.query,
        p_range_days: input.rangeDays,
        p_limit: input.pageSize,
        p_offset: input.offset
      }, (data) => AdminFeedbackListSchema.parse(data))
    }
  }
}
```

The infrastructure adapter receives only the bounded numeric `offset` validated by shared contracts. It must not import a web URL parser or encode/decode cursors.

Add `"@showready/application": "workspace:*"` to `packages/infrastructure/package.json` so the concrete Supabase adapter can implement the consumer-owned `AdminDashboardGateway` port without duplicating it. Run `corepack pnpm install --lockfile-only` after this package change.

- [ ] **Step 4: Export the gateway and pass the focused tests.**

Append this line to `packages/infrastructure/src/index.ts`:

```ts
export * from "./admin-dashboard"
```

Run: `corepack pnpm --filter @showready/infrastructure exec vitest run tests/admin-dashboard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the gateway implementation.**

```bash
git add packages/infrastructure/package.json packages/infrastructure/src/admin-dashboard.ts packages/infrastructure/src/index.ts packages/infrastructure/tests/admin-dashboard.test.ts pnpm-lock.yaml
git commit -m "feat: add admin dashboard supabase gateway"
```

### Task 5: Scaffold the private admin app and owner authentication

**Files:**

- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/tsconfig.json`
- Create: `apps/admin-web/next.config.mjs`
- Create: `apps/admin-web/vitest.config.ts`
- Create: `apps/admin-web/vitest.setup.ts`
- Create: `apps/admin-web/next-env.d.ts`
- Create: `apps/admin-web/app/layout.tsx`
- Create: `apps/admin-web/app/globals.css`
- Create: `apps/admin-web/app/sign-in/page.tsx`
- Create: `apps/admin-web/app/access-denied/page.tsx`
- Create: `apps/admin-web/app/auth/callback/route.ts`
- Create: `apps/admin-web/components/sign-in-form.tsx`
- Create: `apps/admin-web/lib/auth.ts`
- Create: `apps/admin-web/lib/auth.test.ts`
- Create: `apps/admin-web/lib/query.ts`
- Create: `apps/admin-web/lib/query.test.ts`
- Create: `apps/admin-web/lib/env.ts`
- Create: `apps/admin-web/lib/env.test.ts`
- Create: `apps/admin-web/lib/supabase/admin.ts`
- Create: `apps/admin-web/lib/supabase/browser.ts`
- Create: `apps/admin-web/lib/supabase/server.ts`
- Create: `apps/admin-web/proxy.ts`
- Create: `apps/admin-web/.env.example`

- [ ] **Step 1: Create the package scaffold and install the new workspace dependencies.**

Create `apps/admin-web/package.json`:

```json
{
  "name": "@showready/admin-web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "next build",
    "dev": "next dev",
    "start": "next start",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@showready/application": "workspace:*",
    "@showready/contracts": "workspace:*",
    "@showready/design-system": "workspace:*",
    "@showready/infrastructure": "workspace:*",
    "@supabase/ssr": "^0.7.0",
    "@supabase/supabase-js": "^2.84.0",
    "next": "^16.0.1",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "server-only": "^0.0.1",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.6.1",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "jsdom": "^29.0.2"
  }
}
```

Copy the path aliases and TypeScript options from `apps/intake-web/tsconfig.json`, changing only the app-relative base paths. Use the same Vitest alias shape as `apps/intake-web/vitest.config.ts`, exclude `.next`, `dist`, and `node_modules`, and set `setupFiles: ["./vitest.setup.ts"]`. Create `apps/admin-web/vitest.setup.ts` with `import "@testing-library/jest-dom/vitest"` so the component tests can use `toBeInTheDocument()`.

Run: `corepack pnpm install --lockfile-only`

Expected: `pnpm-lock.yaml` is updated with the new workspace importer and no package version is downgraded.

- [ ] **Step 2: Write failing authorization, callback, and query-parser tests.**

`apps/admin-web/lib/auth.test.ts` must mock the server Supabase client and assert all three outcomes:

```ts
it("redirects anonymous visitors to sign-in", async () => {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(requireAdminPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
  expect(mockRedirect).toHaveBeenCalledWith("/sign-in")
})

it("redirects non-owner users to access denied", async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "other@example.com" } }, error: null })
  await expect(requireAdminPage()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })
  expect(mockRedirect).toHaveBeenCalledWith("/access-denied")
})

it("returns the configured owner", async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-1", email: "OWNER@example.com" } }, error: null })
  await expect(requireAdminPage()).resolves.toMatchObject({ id: "u-1" })
})
```

`apps/admin-web/app/auth/callback/route.test.ts` must assert that a callback with `code=abc` calls `exchangeCodeForSession("abc")` and redirects only to `/`; it must also assert that `?next=https://attacker.example` does not alter the destination.

`apps/admin-web/lib/query.test.ts` must assert that an invalid range becomes 30, an overlong query becomes the empty string, and a URL cursor decodes only to a bounded non-negative offset. It must also assert that `buildPageCursors(25, 25, 75, 25)` yields cursors that decode to previous offset 0 and next offset 50.

Run: `corepack pnpm --filter @showready/admin-web exec vitest run lib/auth.test.ts lib/query.test.ts app/auth/callback/route.test.ts`

Expected: FAIL because the authentication and query modules do not exist.

- [ ] **Step 3: Implement public environment access, server secrets, Supabase session clients, and query parsing.**

`apps/admin-web/lib/env.ts` must expose:

```ts
export function getSupabaseUrl(): string
export function getSupabaseAnonKey(): string
export function getAdminOwnerEmail(): string
export function getSupabaseServiceRoleKey(): string
```

`getAdminOwnerEmail` lowercases and trims `ADMIN_OWNER_EMAIL`, and throws if it is empty. `getSupabaseAnonKey` rejects a JWT with `role: "service_role"` and any `sb_secret_` key; reuse the same parsing behavior as `apps/intake-web/lib/supabase/key-safety.ts` without importing private code from the other app.

Implement:

```ts
// lib/supabase/browser.ts
export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}

// lib/supabase/admin.ts
import "server-only"
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
```

Implement `createServerSupabaseClient` with `createServerClient`, `await cookies()`, and a `getAll`/`setAll` cookie adapter. The `setAll` adapter must catch errors because Server Components may read but cannot mutate cookies.

Implement `apps/admin-web/lib/query.ts` so raw URL query parsing stays in the web boundary. Encode `{ offset }` with `Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url")`. Decode it with `Buffer.from(cursor, "base64url").toString("utf8")` followed by `AdminCursorPayloadSchema.safeParse(JSON.parse(value))`; return offset `0` on missing, malformed, negative, non-integer, or `> 5000` values. `parseRangeDays` accepts only 7, 30, and 90, defaulting to 30. `parseAgentListQuery` and `parseFeedbackListQuery` trim the query, replace an over-100-character query with `""`, parse page size as 25 or 50 (default 25), and pass the decoded numeric offset to the shared input schema. `buildPageCursors(offset, itemCount, total, pageSize)` returns `{ previousCursor, nextCursor }`, where the previous offset is `max(0, offset - pageSize)` and next exists only if `offset + itemCount < total`.

Add this exact `.env.example` content; do not add an actual `.env` file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_replace_me
SUPABASE_SERVICE_ROLE_KEY=sb_secret_replace_me
ADMIN_OWNER_EMAIL=owner@example.com
```

- [ ] **Step 4: Implement owner enforcement, magic-link sign-in, callback exchange, and session refresh.**

`lib/auth.ts` must normalize user email with `trim().toLowerCase()` and implement:

```ts
export async function requireAdminPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email) redirect("/sign-in")
  if (normalizeEmail(user.email) !== getAdminOwnerEmail()) redirect("/access-denied")

  return user
}
```

Build `SignInForm` as a client component with one email input and a submit button. Its submit handler calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })`, disables the button during the request, and renders either a generic success message or the returned safe error message.

The callback route must exchange a `code` when present, then use `NextResponse.redirect(new URL("/", request.url))`. It must never read a redirect destination from the request.

`proxy.ts` refreshes the Supabase session using `getUser()` and writes any returned cookies to `NextResponse.next({ request })`. It does not grant access; every protected layout still invokes `requireAdminPage`.

- [ ] **Step 5: Run authentication and environment tests.**

Run: `corepack pnpm --filter @showready/admin-web exec vitest run lib/auth.test.ts lib/env.test.ts app/auth/callback/route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the admin application foundation.**

```bash
git add apps/admin-web pnpm-lock.yaml
git commit -m "feat: add private admin web authentication"
```

### Task 6: Compose safe dashboard reads and build the owner-facing pages

**Files:**

- Create: `apps/admin-web/lib/dashboard.ts`
- Create: `apps/admin-web/app/(owner)/layout.tsx`
- Create: `apps/admin-web/app/(owner)/page.tsx`
- Create: `apps/admin-web/app/(owner)/users/page.tsx`
- Create: `apps/admin-web/app/(owner)/users/[agentId]/page.tsx`
- Create: `apps/admin-web/app/(owner)/feedback/page.tsx`
- Create: `apps/admin-web/app/(owner)/error.tsx`
- Create: `apps/admin-web/components/admin-shell.tsx`
- Create: `apps/admin-web/components/metric-card.tsx`
- Create: `apps/admin-web/components/date-range-links.tsx`
- Create: `apps/admin-web/components/pagination-links.tsx`
- Create: `apps/admin-web/components/user-list.tsx`
- Create: `apps/admin-web/components/feedback-list.tsx`
- Create: `apps/admin-web/components/agent-detail.tsx`
- Create: `apps/admin-web/components/admin-shell.test.tsx`
- Create: `apps/admin-web/components/user-list.test.tsx`
- Create: `apps/admin-web/components/feedback-list.test.tsx`
- Modify: `apps/admin-web/app/globals.css`

- [ ] **Step 1: Write failing presentational tests for the navigation and PII-minimized tables.**

```tsx
// apps/admin-web/components/user-list.test.tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { UserList } from "./user-list"

it("renders account and aggregate fields without any lead/client columns", () => {
  render(
    <UserList
      result={{
        items: [{
          id: "00000000-0000-4000-8000-000000000001",
          fullName: "Morgan Agent",
          email: "morgan@example.com",
          brokerage: "North Realty",
          joinedAt: "2026-07-01T00:00:00.000Z",
          lastTrackedActivityAt: "2026-07-14T00:00:00.000Z",
          leadCount: 3,
          submittedIntakeCount: 2,
          appointmentCount: 1
        }],
        total: 1
      }}
    />
  )

  expect(screen.getByText("Morgan Agent")).toBeInTheDocument()
  expect(screen.getByText("morgan@example.com")).toBeInTheDocument()
  expect(screen.queryByText(/client|buyer|phone|address/i)).not.toBeInTheDocument()
})
```

`admin-shell.test.tsx` must assert that the three navigation links are `/`, `/users`, and `/feedback`. `feedback-list.test.tsx` must assert that each feedback entry links to `/users/<agentId>` and displays message, source, and timestamp.

- [ ] **Step 2: Run the component tests to verify they fail.**

Run: `corepack pnpm --filter @showready/admin-web exec vitest run components/admin-shell.test.tsx components/user-list.test.tsx components/feedback-list.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Build the server-only dashboard composition root.**

Create `apps/admin-web/lib/dashboard.ts`:

```ts
import "server-only"

import {
  getAdminAgentDetail,
  getAdminDashboardOverview,
  listAdminAgents,
  listAdminFeedback
} from "@showready/application"
import type { AdminAgentListQuery, AdminFeedbackListQuery } from "@showready/contracts"
import { createAdminDashboardGateway } from "@showready/infrastructure"
import { buildPageCursors } from "@/lib/query"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"

function getGateway() {
  return createAdminDashboardGateway(createSupabaseAdminClient())
}

export function loadOverview(rangeDays: 7 | 30 | 90) {
  return getAdminDashboardOverview(getGateway(), rangeDays)
}

export async function loadAgents(input: AdminAgentListQuery) {
  const result = await listAdminAgents(getGateway(), input)
  return { ...result, ...buildPageCursors(input.offset, result.items.length, result.total, input.pageSize) }
}

export function loadAgentDetail(agentId: string, rangeDays: 7 | 30 | 90) {
  return getAdminAgentDetail(getGateway(), agentId, rangeDays)
}

export async function loadFeedback(input: AdminFeedbackListQuery) {
  const result = await listAdminFeedback(getGateway(), input)
  return { ...result, ...buildPageCursors(input.offset, result.items.length, result.total, input.pageSize) }
}
```

`loadAgents` and `loadFeedback` attach `nextCursor`/`previousCursor` after the strict RPC response is parsed. This keeps the database and shared application contracts numeric and bounded, while the web layer owns opaque URL encoding.

- [ ] **Step 4: Implement the protected layout and four small pages.**

`app/(owner)/layout.tsx` must call `await requireAdminPage()` before rendering `AdminShell`. No page may import `createSupabaseAdminClient` directly; every page uses the loader above.

Each page takes `searchParams` and canonicalizes it with `lib/query.ts`:

```ts
const rangeDays = parseRangeDays(searchParams.range)
const input = parseAgentListQuery(searchParams)
```

Build the pages as follows:

- `/`: `loadOverview(rangeDays)`, eight `MetricCard`s, a simple date/count table for daily product-event volume, and a top-five error-group table. Do not add a charting dependency.
- `/users`: a GET search form (`query`), range links, `loadAgents(input)`, and `UserList`. Columns: Agent, Brokerage, Joined, Last tracked activity, Leads, Submitted intakes, Appointments. Show an explicit empty state.
- `/users/[agentId]`: validate `agentId` with `z.string().uuid()`, call `loadAgentDetail`, and call `notFound()` on `null`. Render profile, three aggregate cards, and four fixed tables: Recent tracked activity, Feedback, Diagnostics, Server errors. Do not render event properties, diagnostic context/breadcrumbs, or server-error stacks.
- `/feedback`: GET search form and range links, `loadFeedback(input)`, and `FeedbackList`. Columns: Agent, Submitted, Source, Message.

`PaginationLinks` must preserve the current `query`, `range`, and `pageSize` values, use only the opaque cursors produced by `buildPageCursors`, and render no next/previous link when its cursor is absent.

`app/(owner)/error.tsx` is a client component that renders only “Unable to load dashboard data.” and a retry button. It must not interpolate `error.message` or an error stack.

Use `buildWebCssVariables()` in `app/layout.tsx` and add only the styles required for a responsive shell, semantic tables, metric cards, search form, and empty/error states. Follow the existing ShowReady neutral/cypress token set; do not introduce a second visual system or a UI component library.

- [ ] **Step 5: Run the component suite and typecheck.**

Run: `corepack pnpm --filter @showready/admin-web test`

Expected: PASS.

Run: `corepack pnpm --filter @showready/admin-web typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit the dashboard pages.**

```bash
git add apps/admin-web
git commit -m "feat: add read-only admin dashboard pages"
```

### Task 7: Persist admin-app failures safely and verify secret/PII safety

**Files:**

- Create: `apps/admin-web/instrumentation.ts`
- Create: `apps/admin-web/lib/observability.ts`
- Create: `apps/admin-web/lib/observability.test.ts`
- Create: `apps/admin-web/tests/admin-safety.test.ts`

- [ ] **Step 1: Write failing tests for redaction and public-secret safety.**

```ts
// apps/admin-web/lib/observability.test.ts
import { describe, expect, it } from "vitest"
import { createAdminServerErrorRow } from "./observability"

it("redacts email, bearer tokens, and query values before storing an admin error", () => {
  const row = createAdminServerErrorRow(new Error("user@example.com Bearer secret-token"), {
    path: "/users?email=user@example.com",
    method: "GET",
    route: "admin.users"
  })

  expect(row.message).not.toContain("user@example.com")
  expect(row.message).not.toContain("secret-token")
  expect(row.path).toBe("/users")
})
```

`apps/admin-web/tests/admin-safety.test.ts` must read all `apps/admin-web/**/*.{ts,tsx}` source files and assert that no file references `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, and that no browser component imports `@/lib/supabase/admin` or `@/lib/dashboard`.

- [ ] **Step 2: Run the safety tests to verify they fail.**

Run: `corepack pnpm --filter @showready/admin-web exec vitest run lib/observability.test.ts tests/admin-safety.test.ts`

Expected: FAIL because the observability helper and safety tests’ target modules do not exist.

- [ ] **Step 3: Implement bounded, redacted server-error persistence and Next instrumentation.**

Create `apps/admin-web/lib/observability.ts` with a pure exported `createAdminServerErrorRow` and a `captureAdminServerError` writer. Reuse the established redaction policy from `apps/intake-web/lib/observability.ts`:

```ts
const SENSITIVE_CONTEXT_KEYS = [
  "authorization", "cookie", "email", "phone", "address", "note", "notes",
  "token", "password", "secret", "header", "headers", "body", "payload",
  "request", "response"
]
```

The persisted row contains only `id`, `request_id`, `route`, `method`, normalized `path` without query values, bounded redacted `message`, bounded redacted `stack`, `error_type`, empty `query_keys`, `{ app: "admin-web" }` context, and `occurred_at`. It sets `agent_id` to `null`; the admin owner is not an agent account and must not be invented as one.

`captureAdminServerError` must catch and log its own persistence failure, then return normally so observability can never make a request fail.

Create `apps/admin-web/instrumentation.ts`:

```ts
import type { Instrumentation } from "next"
import { captureAdminServerError } from "./lib/observability"

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await captureAdminServerError(error, {
    route: `next.${context.routeType ?? "request"}.${context.routePath ?? "unknown"}`,
    method: request.method,
    path: request.path
  })
}
```

- [ ] **Step 4: Run the safety tests and full admin suite.**

Run: `corepack pnpm --filter @showready/admin-web exec vitest run lib/observability.test.ts tests/admin-safety.test.ts`

Expected: PASS.

Run: `corepack pnpm --filter @showready/admin-web test && corepack pnpm --filter @showready/admin-web typecheck`

Expected: both commands PASS.

- [ ] **Step 5: Commit observability and safety checks.**

```bash
git add apps/admin-web/instrumentation.ts apps/admin-web/lib/observability.ts apps/admin-web/lib/observability.test.ts apps/admin-web/tests/admin-safety.test.ts
git commit -m "feat: add admin dashboard observability safeguards"
```

### Task 8: Validate the workspace, document configuration, and deploy the private app

**Files:**

- Create: `apps/admin-web/README.md`
- Modify: `docs/launch-rollback-plan.md`

- [ ] **Step 1: Write the app runbook.**

Create `apps/admin-web/README.md` with these exact sections:

```md
# ShowReady Admin Web

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set the existing Supabase project URL, anon key, service-role key, and the one authorized `ADMIN_OWNER_EMAIL`.
3. Add `http://localhost:3001/auth/callback` to the Supabase Auth redirect allow list.
4. Run `corepack pnpm --filter @showready/admin-web dev -- --port 3001`.

## Production setup

1. Deploy `apps/admin-web` as a separate project and set its root directory to `apps/admin-web`.
2. Set the four environment variables from `.env.example` in the deployment environment.
3. Add `https://admin.showready.app/auth/callback` to the Supabase Auth redirect allow list.
4. Restrict the production hostname to HTTPS and keep `ADMIN_OWNER_EMAIL` out of public environment variables.

## Data boundary

The dashboard is owner-only and read-only. It exposes agent account details, aggregate workflow counts, product-event metadata, feedback, and sanitized diagnostics. It must not expose lead/client records or raw diagnostic/server-error payloads.
```

- [ ] **Step 2: Add an admin-dashboard rollback section to the launch runbook.**

Append a section to `docs/launch-rollback-plan.md` that says the admin deployment can be rolled back independently by reverting its deployment, removing its Supabase Auth callback URL, and unsetting `ADMIN_OWNER_EMAIL`; this does not require reverting the mobile or intake applications. State that the SQL RPCs are read-only and can remain in place during an application rollback.

- [ ] **Step 3: Run every workspace verification command.**

Run: `corepack pnpm --filter @showready/contracts test && corepack pnpm --filter @showready/application test && corepack pnpm --filter @showready/infrastructure test && corepack pnpm --filter @showready/intake-web test && corepack pnpm --filter @showready/admin-web test`

Expected: all package test suites PASS.

Run: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build`

Expected: PASS. Investigate and fix any failure before deployment; do not weaken a test or type rule to make the command pass.

- [ ] **Step 4: Perform the production smoke test after deployment.**

1. Open `https://admin.showready.app` while signed out; expected result: redirect to `/sign-in`.
2. Request an email link for `ADMIN_OWNER_EMAIL`, complete authentication, and verify Overview, Users, an agent detail page, and Feedback render.
3. Sign in with a non-owner test account; expected result: `/access-denied` and no dashboard data.
4. Inspect browser source/network; expected result: no service-role secret and no response containing `buyer_name`, `buyer_email`, `buyer_phone`, `breadcrumbs`, or `stack`.
5. Force a non-production database failure; expected result: the UI shows a generic error state and a sanitized `server_error_events` row with `context.app = "admin-web"` is recorded.

- [ ] **Step 5: Commit the runbook.**

```bash
git add apps/admin-web/README.md docs/launch-rollback-plan.md
git commit -m "docs: add admin dashboard runbook"
```

## Final acceptance checklist

- [ ] The dashboard is a separate `apps/admin-web` project in the existing workspace.
- [ ] Only `ADMIN_OWNER_EMAIL` can read protected pages.
- [ ] The browser cannot receive a service-role key or direct table access.
- [ ] Overview uses actual business records for workflow totals and labels event-based activity as tracked activity.
- [ ] Users shows agent accounts and aggregates only, never lead/client data.
- [ ] Feedback is read-only and links to the relevant agent.
- [ ] Agent detail has only the approved profile, aggregate, event, feedback, diagnostics, and server-error fields.
- [ ] Dashboard RPCs are executable only by `service_role`.
- [ ] Empty, failure, anonymous, and non-owner states are covered by tests.
- [ ] All targeted tests, workspace typechecks, lint, build, and production smoke checks pass.
