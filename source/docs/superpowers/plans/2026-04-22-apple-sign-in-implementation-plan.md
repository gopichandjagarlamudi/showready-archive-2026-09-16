# Apple Sign-In Implementation Plan

- Date: 2026-04-22
- Related spec: `docs/superpowers/specs/2026-04-22-apple-sign-in-design.md`
- Goal: Implement native Apple sign-in for the iOS Expo app with Supabase ID-token auth, first-sign-in name capture, relay-email rejection, and iOS-only UI exposure

## Outcome

At the end of this plan, iOS builds of the ShowReady mobile app should be able to authenticate with Apple natively, exchange the Apple identity token with Supabase, and either create a new user or sign into the existing same-email user. The first release should support:

- native Apple sign-in on iOS only
- automatic Supabase session creation through `signInWithIdToken`
- first-sign-in persistence of `full_name`, `given_name`, and `family_name`
- relay-email rejection for `privaterelay.appleid.com`
- unchanged Android behavior
- unchanged Google and email/password flows
- unchanged ability to edit profile name in Settings

## Delivery Sequence

1. Add Apple auth dependencies and iOS config.
2. Add the Apple auth helper with test-first coverage.
3. Wire the iOS-only Apple button into the sign-in screen.
4. Verify auth behavior, diagnostics, and metadata persistence.
5. Update developer-facing auth notes where needed.

## Phase 1: Dependencies And Native Configuration

### Tasks

- Add `expo-apple-authentication` to `apps/agent-mobile/package.json`.
- Add `expo-crypto` to `apps/agent-mobile/package.json` for SHA-256 nonce hashing.
- Update `apps/agent-mobile/app.json` to:
  - register the Apple authentication plugin
  - enable `ios.usesAppleSignIn`
- Rebuild or resync the iOS native project so the Apple Sign In capability is applied.
- Verify the generated entitlement exists in `apps/agent-mobile/ios/ShowReady/ShowReady.entitlements` after config sync.

### Notes

- The app already uses `crypto.randomUUID()` in the mobile runtime, so raw nonce generation can stay local.
- Apple should receive the SHA-256 hashed nonce.
- Supabase should receive the raw nonce in `signInWithIdToken`.

### Acceptance criteria

- The mobile app installs with Apple Sign In capability enabled for the iOS target.
- Required dependencies are available to both runtime code and Jest tests.
- No Android-specific configuration changes are introduced.

## Phase 2: Apple Auth Helper

### Tasks

- Add `apps/agent-mobile/lib/auth-apple.ts`.
- Define a result shape aligned with the existing Google helper pattern:
  - `success`
  - `cancel`
  - `error`
- Implement helper responsibilities:
  - check Apple auth availability
  - generate a raw nonce
  - hash the nonce with SHA-256 for Apple
  - start `AppleAuthentication.signInAsync(...)`
  - request `EMAIL` and `FULL_NAME` scopes
  - validate `identityToken`
  - reject `privaterelay.appleid.com` email addresses when an email is returned
  - call `supabase.auth.signInWithIdToken({ provider: "apple", token, nonce: rawNonce })`
  - persist first-sign-in name metadata with `supabase.auth.updateUser(...)`
- Keep metadata persistence best-effort:
  - auth success should not be rolled back if `updateUser` fails
  - metadata write failure should be surfaced to diagnostics rather than the user session flow

### Tests first

- Add `apps/agent-mobile/lib/auth-apple.test.ts` before production code.
- Cover:
  - successful Apple sign-in with raw and hashed nonce handling
  - user cancellation
  - unavailable Apple auth
  - missing `identityToken`
  - relay-email rejection
  - successful session creation plus metadata persistence
  - successful session creation when metadata persistence fails

### Acceptance criteria

- The helper does not depend on browser redirects or `apps/intake-web`.
- The helper uses the nonce flow expected by Apple and Supabase.
- Relay-email rejection is deterministic and user-friendly.

## Phase 3: Sign-In Screen Integration

### Tasks

- Update `apps/agent-mobile/app/(auth)/sign-in.tsx`.
- Preserve the existing email/password and Google actions.
- Add Apple auth availability state that resolves once on mount.
- Render the official Expo Apple button only when:
  - the platform is iOS
  - Apple auth is available
- Wire the button press to the new Apple helper.
- Reuse the existing inline error message area for Apple failures.
- Record diagnostics failures with `method: "apple"` using the current diagnostics service.

### UI behavior

- Do not show the Apple button on Android.
- Do not show a disabled Apple button on unsupported builds.
- Treat user-cancelled Apple auth as a no-op rather than an error banner.
- Keep the screen pending state coherent so multiple auth actions cannot be started in parallel.

### Tests first

- Add a new sign-in screen test file, for example:
  - `apps/agent-mobile/tests/sign-in-screen.test.tsx`
- Cover:
  - Apple button renders on iOS when available
  - Apple button is hidden on unsupported builds
  - tapping Apple starts the helper
  - Apple helper error shows inline feedback
  - Apple helper cancel does not show an error

### Acceptance criteria

- The sign-in screen exposes Apple only where intended.
- Existing sign-in options keep their current behavior.
- Apple auth failures are observable without degrading the rest of the screen.

## Phase 4: Verification Of Metadata And Account Semantics

### Tasks

- Confirm the app writes Apple name metadata keys expected by the existing backend scaffold path:
  - `full_name`
  - `given_name`
  - `family_name`
- Verify `apps/intake-web/lib/supabase/data.ts` does not need changes because `getDisplayName()` already reads `full_name` and `name`.
- Verify the existing Settings flow in `apps/agent-mobile/app/(app)/settings.tsx` remains editable after Apple sign-in.
- Confirm no changes are needed in the mobile session bootstrap path after Supabase creates the session.

### Manual verification

- Brand-new user:
  - sign in with Apple on iOS
  - confirm a Supabase user and mobile session are created
  - confirm the first authenticated mobile flow creates the expected backend scaffold
- Existing user:
  - sign in with Apple using the same real email as an existing ShowReady account
  - confirm the Apple identity attaches to the same Supabase user rather than creating a second account
- Name handling:
  - confirm first-sign-in name lands in Supabase user metadata
  - confirm Settings can still change the profile name afterward
- Relay email:
  - attempt Apple sign-in with Hide My Email
  - confirm the app rejects the login with the intended guidance

### Acceptance criteria

- New users can onboard through Apple without extra backend changes.
- Existing same-email users land in the correct account.
- Metadata capture improves initial profile naming without removing post-login editability.

## Phase 5: Regression Coverage And Dev Notes

### Tasks

- Run focused mobile tests for:
  - `auth-apple`
  - sign-in screen
  - existing auth helper regressions if impacted
- Run TypeScript checks for `@showready/agent-mobile`.
- Update the mobile auth notes in `README.md` if the current wording is too Google-specific after Apple support lands.
- Document the required project-side dependency that still lives outside this repo:
  - Apple provider enabled in Supabase Auth
  - correct bundle identifier registered for Apple Sign In

### Acceptance criteria

- The new feature is covered by focused unit tests.
- The mobile app typechecks after the changes.
- The repo docs do not imply Google is the only supported mobile social login.

## File-Level Worklist

### Mobile app

- `apps/agent-mobile/package.json`
- `apps/agent-mobile/app.json`
- `apps/agent-mobile/app/(auth)/sign-in.tsx`
- `apps/agent-mobile/lib/auth-apple.ts`
- `apps/agent-mobile/lib/auth-apple.test.ts`
- `apps/agent-mobile/tests/sign-in-screen.test.tsx`

### Native verification targets

- `apps/agent-mobile/ios/ShowReady/ShowReady.entitlements`

### Optional documentation touchpoints

- `README.md`

## Risks

- Apple name fields are one-time data, so a missed first-write bug is costly.
- Expo and native iOS capability sync can fail silently if the local native project is stale.
- Relay-email rejection is intentional for v1 but will block some real users until a future linking flow exists.
- The worktree already contains unrelated auth changes, so implementation must avoid editing the current Google bridge unless strictly necessary.

## Recommended Execution Order

1. Add tests for the Apple helper.
2. Implement the helper until those tests pass.
3. Add sign-in screen tests for iOS-only rendering and error handling.
4. Wire the Apple button into the screen until those tests pass.
5. Sync iOS config and verify the entitlement.
6. Run focused tests and manual iOS validation on a development build.
