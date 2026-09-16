# Apple Sign-In Design

- Date: 2026-04-22
- Product: ShowReady mobile app
- Status: Approved for spec drafting
- Scope: Native Sign in with Apple for the iOS Expo app backed by Supabase Auth

## Summary

ShowReady needs Apple sign-in in the iOS Expo app without changing the existing `apps/intake-web` surface in this repository. The selected approach is to add native Apple authentication in the mobile app with `expo-apple-authentication`, exchange the returned Apple ID token with Supabase via `signInWithIdToken`, and persist Apple's one-time name payload into Supabase user metadata on first sign-in.

This design intentionally keeps the existing Google browser-based mobile OAuth bridge unchanged and does not add Apple sign-in to `apps/intake-web`. It also intentionally defers manual account-linking flows for Apple relay emails. In v1, users must sign in with a real Apple email address so Supabase can automatically link Apple to an existing ShowReady user when the verified email matches.

## Goals

- Add Sign in with Apple to the iOS Expo app.
- Allow Apple sign-in to create a new Supabase user automatically on first use.
- Allow Apple sign-in to log into an existing ShowReady user when the email matches.
- Capture Apple's one-time name payload on first sign-in and save it into Supabase user metadata.
- Preserve the existing Settings screen as the place where the user can edit their profile name later.
- Keep Android and `apps/intake-web` behavior unchanged.

## Non-Goals

- Adding Apple sign-in to `apps/intake-web` in this repository.
- Replacing the existing Google mobile auth flow.
- Building a manual identity-linking flow for mismatched or relay-email Apple identities.
- Automating full end-to-end Apple sign-in in CI.
- Removing the ability to edit the agent profile name in Settings.

## Selected Approach

The mobile app will add a native Apple sign-in helper that uses `expo-apple-authentication` on iOS, requests `EMAIL` and `FULL_NAME` scopes, and signs into Supabase with `supabase.auth.signInWithIdToken({ provider: "apple", ... })`.

After a successful Supabase sign-in:

1. If Apple's response includes a real email address, Supabase Auth will use that verified email to either create a new user or automatically link the Apple identity to an existing user with the same email.
2. If Apple's response includes the user's name on first authorization, the app will write that name into Supabase user metadata with `supabase.auth.updateUser(...)`.
3. If the app detects an Apple relay address from `privaterelay.appleid.com`, it will reject the sign-in for v1 and ask the user to retry while sharing their real email.

This approach follows current Expo guidance for native Apple auth on iOS and current Supabase guidance for native Apple sign-in with ID tokens.

## Architecture

### Mobile authentication flow

The iOS app will introduce a dedicated Apple auth helper alongside the existing Google helper:

- `apps/agent-mobile/lib/auth-apple.ts`

Responsibilities:

- verify that Apple auth is available on the device
- generate a nonce for the Apple request and Supabase token exchange
- start the native Apple sign-in flow
- validate that an Apple identity token is present
- reject relay-email accounts for this v1 release
- exchange the Apple ID token with Supabase
- persist available Apple name fields into Supabase user metadata
- return a result shape consistent with the existing Google helper pattern

The current browser callback bridge in `apps/agent-mobile/lib/auth-oauth.ts` remains unchanged and continues to serve Google sign-in only.

### Sign-in surface

The mobile sign-in screen will be updated in:

- `apps/agent-mobile/app/(auth)/sign-in.tsx`

Changes:

- keep email/password and Google buttons as they are
- render the official Apple button only on iOS when Apple auth is available
- hide the Apple button on Android and other unsupported builds
- surface Apple auth errors in the same inline error area already used by the screen
- record diagnostics failures with `method: "apple"`

The Apple button should use the native Expo Apple button component rather than the app's custom button component.

### iOS configuration

The mobile app config will be updated in:

- `apps/agent-mobile/app.json`

Changes:

- enable `ios.usesAppleSignIn`
- add the Expo Apple authentication plugin

If the generated native project needs it after config sync, the iOS entitlement for Apple Sign In should also be present in:

- `apps/agent-mobile/ios/ShowReady/ShowReady.entitlements`

The app already uses a custom URL scheme for Google auth callbacks. Apple native sign-in in this design does not depend on that browser callback scheme.

## Data Flow

1. The user opens the iOS sign-in screen.
2. The app determines whether Apple auth is available on the current build and device.
3. If available, the screen renders the native Apple button.
4. The user taps Apple sign-in.
5. The app starts `AppleAuthentication.signInAsync(...)` with `EMAIL` and `FULL_NAME` scopes plus a nonce.
6. Apple returns a credential payload.
7. The app validates:
   - the user did not cancel
   - `identityToken` exists
   - the returned email is not a `privaterelay.appleid.com` address when email is present
8. The app exchanges the Apple ID token with Supabase using `signInWithIdToken`.
9. Supabase either creates a new user or automatically links Apple to the existing verified-email user.
10. If Apple provided name fields on first sign-in, the app updates Supabase user metadata with:
   - `full_name`
   - `given_name`
   - `family_name`
11. The existing session bootstrap path continues normally.
12. On the first authenticated backend call, existing scaffold logic can derive an initial profile name from Supabase user metadata if a backend agent row does not already exist.

## Components

### Mobile app

- `auth-apple`
  - native Apple authentication orchestration
- `sign-in screen`
  - conditional Apple button rendering and inline error handling
- existing session provider
  - unchanged session lifecycle behavior after successful sign-in
- existing diagnostics service
  - records Apple auth failures without changing the rest of the auth stack

### Backend behavior reused as-is

- Supabase Auth
  - creates users and automatically links same-email verified Apple identities
- existing scaffold logic in `apps/intake-web/lib/supabase/data.ts`
  - derives initial agent profile name from user metadata when needed

No new backend route or database schema is required for this feature in v1.

## User Metadata Strategy

Apple does not include the user's full name inside the Apple identity token, and Apple only returns name fields during the first successful authorization. Because of that:

- the mobile app must capture the returned native name payload immediately
- the app must write that payload into Supabase user metadata right after sign-in
- later sign-ins should rely on stored Supabase metadata rather than expecting Apple to return the name again

The app should write:

- `full_name`
- `given_name`
- `family_name`

If metadata persistence fails after the session is created, the app should keep the user signed in and log the metadata write failure. The Settings screen remains the fallback place for the user to edit their display name.

## Failure Handling

- User cancellation is not treated as an error and should return a `cancel` result.
- Missing `identityToken` returns a user-visible Apple sign-in error.
- Relay emails ending in `privaterelay.appleid.com` are rejected for v1 with clear guidance to retry using the real Apple email address.
- Supabase token exchange failures return a user-visible Apple sign-in error and emit diagnostics.
- Name metadata update failures should not sign the user out or discard the created session.
- If Apple auth is unavailable, the Apple button should not render.

## Testing Strategy

### Unit tests

- Apple helper success path with ID token and first-sign-in name payload
- Apple helper cancel path
- Apple helper missing-token failure
- Apple helper relay-email rejection
- Apple helper metadata update persistence
- Sign-in screen renders Apple button only on iOS-capable builds
- Sign-in screen hides Apple button on unsupported builds

### Manual verification

- Sign into a brand-new account with Apple on iOS and verify a new Supabase user/session is created.
- Sign into an existing ShowReady account with Apple using the same real email and verify the identity attaches to the same user.
- Verify first-sign-in Apple name fields appear in Supabase user metadata.
- Verify the existing Settings screen still allows editing the profile name afterward.
- Verify relay-email sign-in is rejected with the intended message.
- Verify Google and email/password sign-in still behave as before.

## Risks

- Users who choose Hide My Email cannot complete Apple sign-in in this v1 design.
- Apple only returns the name once, so missing the first-write path would permanently lose the automatic name capture until the user revokes and reauthorizes the app.
- Native Apple auth is difficult to exercise fully in automated test environments, so manual iOS verification remains important.
- The current worktree already contains in-progress auth changes, so implementation must avoid overwriting unrelated files or flows.

## Rollout

- Implement the Apple helper, native config, and sign-in screen changes behind the existing iOS-only availability checks.
- Validate on a development build or standalone iOS build, not just Expo Go.
- Confirm Supabase project configuration for Apple is enabled before calling the feature complete.
- Leave web Apple sign-in for a separate follow-up in the appropriate web codebase or surface.

## References

- Expo AppleAuthentication docs: https://docs.expo.dev/versions/latest/sdk/apple-authentication
- Supabase Apple auth docs: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Supabase identity linking docs: https://supabase.com/docs/guides/auth/auth-identity-linking
