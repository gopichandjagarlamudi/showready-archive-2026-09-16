# ShowReady Launch Rollback Plan

Use this plan when a production release causes login failures, intake submission failures, data integrity risk, elevated backend errors, or a broken mobile build.

## Release Record

Before each launch, record:

- Release version:
- Git commit SHA:
- Vercel deployment URL:
- EAS iOS build ID:
- EAS Android build ID:
- Supabase project ref:
- Supabase migrations applied:
- Release owner:
- Rollback owner:

## Rollback Triggers

Start rollback if any of these hold for more than 10 minutes after release:

- Mobile sign-in, password reset, or auth callback success rate drops below the prior baseline.
- Public intake submission returns elevated 4xx/5xx errors.
- `server_error_events` shows repeated 5xx errors for launch-critical routes.
- New Supabase migration blocks lead, invite, appointment, diagnostics, or product event writes.
- App Store/TestFlight or Play Store build has a critical navigation, auth, or data-loss bug.
- Email delivery for password reset or auth messages is failing for real users.

## Immediate Stabilization

1. Freeze further deploys and migrations.
2. Record the current time, incident owner, and observed symptoms.
3. Check Vercel production logs and Supabase `server_error_events` by route/status.
4. Disable non-critical jobs only if they are amplifying the incident:

```bash
cd "/Users/gopichandjagarlamudi/Projects/ShowReady Mobile"
corepack pnpm dlx vercel env add JOB_PROCESSOR_TOKEN production
```

Use a new random value only if manual job calls need to be blocked separately from Vercel Cron.

## Vercel Web/API Rollback

Prefer Vercel's dashboard rollback for the linked `showready-intake-web` project:

1. Open Vercel > `showready-intake-web` > Deployments.
2. Select the last known-good production deployment.
3. Promote it to production.
4. Verify:

```bash
curl -I https://showready-intake-web.vercel.app
curl -I https://showready-intake-web.vercel.app/api/jobs/outbox
```

Expected: the app responds, and the guarded job route remains unauthorized without the cron secret.

## Mobile Rollback

For TestFlight:

1. Open App Store Connect > ShowReady > TestFlight.
2. Stop external testing for the bad build.
3. Re-add or keep the previous known-good build for testers.
4. If the bad build is already in App Review, cancel the submission.

For Google Play:

1. Open Play Console > ShowReady > Production or Internal testing.
2. Halt the rollout for the bad release.
3. Retain or promote the previous known-good release track.

If a code fix is faster than store rollback, create a hotfix build:

```bash
cd "/Users/gopichandjagarlamudi/Projects/ShowReady Mobile/apps/agent-mobile"
corepack pnpm dlx eas-cli build --platform ios --profile production
corepack pnpm dlx eas-cli build --platform android --profile production
```

## Supabase Migration Rollback

Never run destructive rollback SQL until a backup/restore point has been confirmed.

1. Identify the migration and tables/functions affected.
2. If the issue is a bad policy/grant/function, prefer a forward-fix migration that restores the last known-good behavior.
3. If data is corrupted or deleted, use Supabase Dashboard > Database > Backups or Point-in-Time Recovery.
4. After restore or forward fix, verify core paths:

```sql
select count(*) from public.agents;
select count(*) from public.leads;
select count(*) from public.invites;
select count(*) from public.server_error_events
where occurred_at >= now() - interval '15 minutes';
```

## Email/Auth Rollback

If custom SMTP breaks password reset or auth email delivery:

1. Switch Supabase Auth SMTP settings to the standby provider if available.
2. Confirm SPF, DKIM, and DMARC records are valid for the active sending domain.
3. Send a password reset to a controlled address and verify delivery and link handling.
4. Do not fall back to Supabase default SMTP for production users except as a short emergency measure, because it is restricted and rate limited.

## Post-Rollback Checks

Run:

```bash
cd "/Users/gopichandjagarlamudi/Projects/ShowReady Mobile"
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Production smoke checks:

- Mobile sign-in works.
- Password reset email is received.
- Public intake form loads and submits.
- New lead appears in the mobile app.
- Outbox cron processes pending jobs.
- `server_error_events` is not increasing for the rolled-back route.

## Communication

Record:

- Incident start time.
- Rollback decision time.
- Rollback completion time.
- User-visible impact.
- Data impact.
- Follow-up owner and deadline.

## Admin Dashboard Rollback

The admin deployment can be rolled back independently by reverting its deployment, removing its Supabase Auth callback URL, and unsetting `ADMIN_OWNER_EMAIL`; this does not require reverting the mobile or intake applications. The SQL RPCs are read-only and can remain in place during an application rollback.
