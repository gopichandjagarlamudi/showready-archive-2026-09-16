# ShowReady Native Rebuild

Standalone monorepo for the ShowReady native agent app and public intake web experience.

## Mobile auth workflow

The mobile app supports:

- email/password
- Google OAuth
- Apple sign-in on iOS

For the native auth flows, use a development build or standalone app instead of relying on Expo Go for final verification.

The app id is `com.showready.mobile` on both iOS and Android. Android local helpers are available from the mobile package:

```bash
corepack pnpm --filter @showready/agent-mobile android:doctor
corepack pnpm --filter @showready/agent-mobile android:emulator
```

Use:

```bash
corepack pnpm --filter @showready/agent-mobile ios
```

or:

```bash
corepack pnpm --filter @showready/agent-mobile android
```

Then start Metro in dev-client mode:

```bash
corepack pnpm --filter @showready/agent-mobile dev
```

If you still need the old Expo Go sandbox for non-auth UI checks, use:

```bash
corepack pnpm --filter @showready/agent-mobile dev:go
```

## Production rollout

Before deploying the scale-hardening changes, apply the SQL files in `apps/intake-web/lib/supabase/sql` to staging and then production, including `2026-05-01-scale-hardening.sql`.

Required production env:

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
RATE_LIMIT_STORE=supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_SITE_URL=
```

`EXPO_PUBLIC_SITE_URL` owns public Support, Privacy, Terms, and Account Deletion links while `EXPO_PUBLIC_API_BASE_URL` remains the API and auth host.

Required when lead email notifications are enabled:

```bash
LEAD_NOTIFICATION_WEBHOOK_URL=
```

The guarded job endpoints are:

- `/api/jobs/outbox`: drains up to 10 pending outbox jobs per run.
- `/api/jobs/retention`: deletes one bounded retention batch per high-volume table.

Both accept Vercel Cron `GET` requests with `Authorization: Bearer $CRON_SECRET`; manual runs can also use `POST` with that header or `x-job-token: $JOB_PROCESSOR_TOKEN`.

The rollback runbook is in `docs/launch-rollback-plan.md`.

Run these checks before rollout:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```
