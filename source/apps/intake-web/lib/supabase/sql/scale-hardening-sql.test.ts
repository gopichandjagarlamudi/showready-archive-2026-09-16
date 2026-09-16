import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("scale hardening SQL migrations", () => {
  it("keeps lead contact retention deletes indexed and batch bounded", () => {
    const sql = readFileSync(
      new URL("./2026-05-03-lead-contact-interactions.sql", import.meta.url),
      "utf8"
    )

    expect(sql).toContain("lead_contact_interactions_occurred_at_idx")
    expect(sql).toContain("greatest(1, least(coalesce(p_batch_size, 5000), 50000))")
  })

  it("finalizes intake submission through a transactional function", () => {
    const sql = readFileSync(
      new URL("./2026-05-01-scale-hardening.sql", import.meta.url),
      "utf8"
    )

    expect(sql).toContain("create or replace function public.finalize_submitted_invite")
    expect(sql).toContain("for update")
    expect(sql).toContain("on conflict do nothing")
    expect(sql).toContain("p_recommendation::public.recommendation")
    expect(sql).toContain(
      "grant execute on function public.finalize_submitted_invite(uuid, uuid, numeric, text, text, jsonb) to service_role"
    )
  })

  it("keeps mobile read-side detail and appointment lookups indexed", () => {
    const sql = readFileSync(
      new URL("./2026-05-04-mobile-read-performance.sql", import.meta.url),
      "utf8"
    )

    expect(sql).toContain("lead_answers_lead_updated_at_idx")
    expect(sql).toContain("lead_scores_lead_created_at_idx")
    expect(sql).toContain("showings_appointment_order_idx")
    expect(sql).toContain("leads_agent_updated_id_idx")
    expect(sql).toContain("public.consume_rate_limits")
  })

  it("keeps launch security RLS and public grants locked down", () => {
    const sql = readFileSync(
      new URL("./2026-05-10-launch-security-hardening.sql", import.meta.url),
      "utf8"
    )

    expect(sql).toContain("alter default privileges for role postgres in schema public")
    expect(sql).toContain("alter table public.leads enable row level security")
    expect(sql).toContain("revoke all on table")
    expect(sql).toContain("from anon")
    expect(sql).toContain("create policy leads_select_own")
    expect(sql).toContain("agent_id = (select auth.uid())")
    expect(sql).toContain("create policy api_rate_limits_no_direct_access")
    expect(sql).toContain("grant select, insert, update, delete on table")
    expect(sql).toContain("to service_role")
  })

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
    expect(sql).toContain("grant execute on function public.list_admin_agents(text, integer, integer) to service_role")
    expect(sql).toContain("revoke all on function public.list_admin_agents(text, integer, integer) from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.get_admin_agent_detail(uuid, integer) to service_role")
    expect(sql).toContain("revoke all on function public.get_admin_agent_detail(uuid, integer) from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.list_admin_feedback(text, integer, integer, integer) to service_role")
    expect(sql).toContain("revoke all on function public.list_admin_feedback(text, integer, integer, integer) from public, anon, authenticated")
    expect(sql).toContain("product_events_occurred_agent_idx")
    expect(sql).toContain("leads_created_at_idx")
    expect(sql).toContain("leads_submitted_at_idx")
    expect(sql).toContain("appointments_created_at_idx")
    expect(sql).not.toContain("buyer_name")
    expect(sql).not.toContain("buyer_email")
    expect(sql).not.toContain("buyer_phone")
    expect(sql).not.toContain("breadcrumbs")
    expect(sql).not.toContain("stack")
  })

  it("paginates dashboard JSON arrays before aggregation", () => {
    const sql = readFileSync(
      new URL("./2026-07-14-admin-dashboard.sql", import.meta.url),
      "utf8"
    )

    expect(sql).not.toContain(
      "order by last_tracked_activity_at desc nulls last, full_name, id\n        limit p_limit offset p_offset\n      )\n      from agent_base"
    )
    expect(sql).not.toContain(
      "order by created_at desc, id desc\n        limit p_limit offset p_offset\n      )\n      from feedback_base"
    )
    expect(sql).toContain(
      "from agent_base\n        order by last_tracked_activity_at desc nulls last, full_name, id\n        limit p_limit offset p_offset"
    )
    expect(sql).toContain(
      "from feedback_base\n        order by created_at desc, id desc\n        limit p_limit offset p_offset"
    )
  })

  it("uses a scalar agent-detail query inside its conditional result", () => {
    const sql = readFileSync(
      new URL("./2026-07-14-admin-dashboard.sql", import.meta.url),
      "utf8"
    )

    expect(sql).toContain(
      "case when exists (select 1 from public.agents where id = p_agent_id) then\n      (\n        select jsonb_build_object("
    )
    expect(sql).toContain(
      "from public.agents a\n        where a.id = p_agent_id\n      )\n    else null"
    )
  })
})
