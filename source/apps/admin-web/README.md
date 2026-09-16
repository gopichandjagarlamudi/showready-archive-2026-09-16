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
