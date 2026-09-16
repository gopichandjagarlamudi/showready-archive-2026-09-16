# Recovery guide

## Recover the private files

1. Clone this private repository and download the release asset `showready-private-backup.fernet` from release `backup-2026-09-16`.
2. Retrieve the matching recovery key from your password manager/offline copy. Its original local location was `/Users/gopichandjagarlamudi/.config/showready-backup-keys/2026-09-16.key`.
3. Verify the asset with `shasum -a 256 -c SHA256SUMS` from the directory containing both files.
4. Create a Python virtual environment and install `cryptography` in it. Run:

   ```sh
   python decrypt_backup.py --key /absolute/path/to/2026-09-16.key --input showready-private-backup.fernet --output recovered-private.tar.gz
   mkdir recovered-private
   tar -xzf recovered-private.tar.gz -C recovered-private
   ```

   Keep decrypted data private and out of Git. `private-staging/file-manifest.json` inside the archive records SHA-256 hashes for every payload file.

## Code

The source snapshot includes local changes that had not been committed. Do not assume it is the exact version currently published on the App Store. The `source-history.bundle` holds full local Git history and fetched remote branches; clone it separately with `git clone source-history.bundle recovered-history` if historical versions are needed. Related web and landing-page history have separate bundles. The original workspace was not switched, committed, reset, or modified by the backup.

Install the pinned package manager and dependencies (`corepack pnpm install --frozen-lockfile`). Read `source/README.md`, the iOS/TestFlight checklist, and launch rollback plan. Restore environment values locally, then run the documented checks before any deployment. Do not run demo seed scripts against a recovered production database.

## Supabase

Project at export: `tpzrcuakggeshednyrap` (ShowReady), PostgreSQL 17.6.

- `supabase/database.dump`: full PostgreSQL custom-format logical archive made by pg_dump 18.3, using a consistent database snapshot.
- `supabase/roles.sql`: role definitions without database-role passwords; role passwords must be re-created.
- `supabase/*-schema.sql`: separate public/auth/storage/migration schema references.
- `supabase/application-data.sql`: public/auth/storage/migration data extracted from the same archive.
- `supabase/auth-config.json`, project/Postgres settings, API-key export, table counts, verification results, and Storage inventory.
- Storage reported **zero buckets and zero objects**. There were **zero Edge Functions, Edge Function secrets, and Vault secrets** at export.

Prefer resuming the existing paused project if still supported. For a new project, start with a fresh managed Supabase project, inspect archive TOC and existing target schemas, and follow the current official migration guide:
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

This archive is a **raw pg_dump**, not the Supabase CLI's filtered dump. Do NOT blindly replay the full dump or roles.sql into an existing managed project: Supabase-owned roles, extensions and schemas already exist. Select the application schema/data and custom policies/triggers from the archive, adapt managed-schema changes to the new project's version, and restore inside a transaction with stop-on-error. Preserve auth users and identities. Review custom auth triggers, RLS policies, grants, publication membership, extensions and migration history. Recreate custom login-role passwords. Inspect scheduled jobs/webhooks before enabling them so a test restore cannot contact real users or external systems.

Reapply supported Auth configuration, OAuth providers, redirect URLs and email settings; validate saved credentials and recreate any provider-masked secrets. A newly created project has different URLs/keys: update Vercel and mobile configuration, and publish a new mobile build if endpoints are embedded. Keep authentication, policies, account deletion and lead flows under test before relaunch.

Verification completed: archive TOC read; complete archive decoded by pg_restore; all 58 inventoried public/auth/storage/migration/Vault table row counts matched the archived COPY records. This is structural/content verification, **not an end-to-end restore into a new Supabase project**.

## Vercel

Exports cover `showready`, `showready-intake-web`, and `showready-mobile-admin-web`. Each has project configuration, domain assignments, environment definitions and up to 20 recent deployment records. Read project configuration for root directory, framework, build commands and runtime. Deployment metadata is not a copy of deployment binaries.

Vercel's `sensitive` variables are write-only and were not exposed by its API. `environment.json` entries with `type: sensitive` have no recoverable value. Do not interpret an empty value or encrypted ciphertext as a usable credential. Only entries marked `decrypted: true` were successfully decrypted from Vercel.

Local environment copies and the older ShowReady project's decrypted variables preserve Supabase URL/anon/service-role credentials, but do not prove every live sensitive variable has the same value. Recreate and validate these at relaunch:

- Intake: NEXT_PUBLIC_APP_URL, RATE_LIMIT_STORE, CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Admin: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_OWNER_EMAIL.

Use `RATE_LIMIT_STORE=supabase` if retaining the documented setup; choose and install a new random CRON_SECRET for both scheduled and manual callers; explicitly choose the authorized ADMIN_OWNER_EMAIL. Restore domains/DNS as appropriate. Domain registrar ownership and external DNS are not exported by this backup.

## Expo, Apple, and other services

Expo readable project environment values and ten recent build records were exported. Attempts to download the latest finished iOS and Android build artifacts were rejected by the artifact host; binaries are not included. App Store artwork, bundle identifier `com.showready.mobile`, EAS project identifier, and App Store app ID are in the code snapshot.

Apple App Store Connect records, reviews, analytics, server-side signing credentials, and App Store binaries were not exported. Apple Developer/Expo signing credentials and any Android release keystore must remain available through their original accounts or be separately recovered; only a local Android debug keystore was found. Apple signing certificates can normally be reissued for future builds, subject to account access. This archive does not replace those accounts or guarantee automatic republishing years later.

The related landing-page snapshot/history is included inside the encrypted archive, but its hosting account, custom domain/DNS configuration and unrelated third-party services were not comprehensively exported. Retain access to Apple, Expo, GitHub, Supabase, Vercel, domain registrar and OAuth-provider accounts.

## Relaunch order

1. Recover and validate the backup in an isolated environment.
2. Restore Supabase and authentication; configure domains and secrets.
3. Redeploy API/intake/admin, then test login, lead creation, access controls and account deletion.
4. Build/test mobile against the restored backend.
5. Restore App Store availability only after the service works.

Do not delete the original services solely on the basis of this archive before completing a restore rehearsal and checking the missing credentials above.
