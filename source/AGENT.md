# ShowReady Test Routes

Use the known-good local routes and entrypoints for every verification pass in this workspace.

## Web

- Start the web surface with `corepack pnpm --filter @showready/intake-web dev`.
- Use `http://localhost:3000` for browser tests and Playwright.
- Do not switch Playwright to `127.0.0.1`; the current Next dev setup is stable on `localhost`.

## Mobile

- Start Metro with `corepack pnpm --filter @showready/agent-mobile dev`.
- Use a development build for mobile auth work, not Expo Go.
- Install or refresh the local build with `corepack pnpm --filter @showready/agent-mobile ios` or `corepack pnpm --filter @showready/agent-mobile android`.
- After the build is installed, open the app binary and connect it to the Metro server started by `corepack pnpm --filter @showready/agent-mobile dev`.
- The current working auth callback scheme is `showready://auth/callback`.
- Keep `EXPO_PUBLIC_API_BASE_URL` on `http://localhost:3000` for local dev.
- For Android local tooling, run `corepack pnpm --filter @showready/agent-mobile android:doctor` to confirm SDK, JDK, emulator, and adb visibility.
- Use the app bundle ids for Maestro:
  - iOS: `com.showready.mobile`
  - Android: `com.showready.mobile`
- Prefix iOS simulator and Maestro commands with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

## Maestro

- Reseed the live demo state before authenticated mobile runs with `corepack pnpm --filter @showready/agent-mobile seed:maestro`.
- Generate a real Supabase-backed auth callback URL for Maestro with:
  - `APP_URL=showready://auth/callback corepack pnpm --filter @showready/agent-mobile maestro:auth-url`
- The command prints the full URL to stdout for command substitution, logs a redacted copy, and writes the full local-only URL to `apps/agent-mobile/.maestro-auth-url`.
- The mobile app now has a concrete Expo Router callback route at `/auth/callback`, so authenticated deep-link runs should use:
  - `showready://auth/callback?...`
- Provide `MAESTRO_DEMO_EMAIL` and `MAESTRO_DEMO_PASSWORD` in local env for authenticated demo flows.
- Android and iOS device automation are still sensitive to native build handoff timing. If a Maestro run stalls before app content appears, rebuild the dev client, restart Metro, and re-open the `showready://auth/callback` deep link rather than switching routes.
- Use the seeded lead ids when you need stable selectors in Maestro:
  - Review lead: `e357e934-6f9a-4d75-bf12-8db0cd1bf701`
  - Appointment lead: `bd30eb53-5bc1-460d-95a2-13c2f7c5e2bb`
  - Detail lead: `da26711a-69dd-4ce2-ab48-8efcf9811f14`
