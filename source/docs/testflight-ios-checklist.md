# ShowReady iOS TestFlight Checklist

This checklist is the shortest path from the current Expo app to a real TestFlight build that 10 external testers can install.

## Current repo status

- The mobile app now uses `com.showready.mobile` for both the Expo config and native iOS/Android identifiers.
- `apps/agent-mobile/eas.json` is present with development, preview, and production profiles.
- The remaining setup work is App Store Connect, Apple signing, hosted beta infrastructure, and the first production iOS build.

## 1. Pick the final iOS app identifier

Use `com.showready.mobile` when creating the iOS app in App Store Connect.

This repo is already aligned to that identifier in:

- `apps/agent-mobile/app.json`
- `apps/agent-mobile/ios/ShowReady.xcodeproj/project.pbxproj`
- `apps/agent-mobile/ios/ShowReady/Info.plist`
- `apps/agent-mobile/android/app/build.gradle`
- `apps/agent-mobile/android/app/src/main/java/com/showready/mobile/*`

## 2. Create the app in App Store Connect

In App Store Connect:

1. Create a new app.
2. Use the exact iOS bundle identifier from step 1.
3. Save the Apple ID for the app. Expo refers to this as `ascAppId`.

Keep this info handy:

- app name
- bundle identifier
- SKU
- Apple ID / `ascAppId`

## 3. Confirm Apple account prerequisites

Before the first upload, confirm all of this:

- Apple Developer Program membership is active.
- App Store Connect agreements are accepted.
- The Apple account you will use has permission to create certificates and manage the app.
- Any export compliance or encryption answers for the app are known.

## 4. Prepare the app for beta review

Before uploading, make sure the build is usable by outside testers:

- real backend environment, not localhost
- stable login flow
- app icon and launch screen look acceptable
- test credentials are ready if Apple reviewers need them
- privacy permission copy is accurate for anything the app requests

## 5. Link Expo EAS to the project

For local simulator testing, the machine must select a full Xcode install rather than
Command Line Tools:

```bash
corepack pnpm --filter @showready/agent-mobile ios:doctor
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

Run from `apps/agent-mobile`:

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init
pnpm dlx eas-cli credentials --platform ios
```

Notes:

- `eas init` links the app to an Expo project and may add the EAS project ID to your Expo config.
- `eas credentials --platform ios` is the easiest way to let EAS manage the iOS distribution certificate and provisioning profile.

## 6. Build the TestFlight candidate

The `production` EAS profile in `apps/agent-mobile/eas.json` is the one to use for TestFlight:

```bash
cd "/Users/gopichandjagarlamudi/Projects/ShowReady Mobile/apps/agent-mobile"
pnpm dlx eas-cli build --platform ios --profile production
```

This generates an App Store signed iOS build suitable for upload to App Store Connect.

## 7. Submit the build to TestFlight

After the build succeeds:

```bash
pnpm dlx eas-cli submit --platform ios --profile production --latest
```

During submit, Expo will ask for or use:

- your Apple account or App Store Connect API key
- the App Store Connect app
- the Apple ID / `ascAppId`

## 8. Finish TestFlight setup in App Store Connect

Once Apple finishes processing the upload:

1. Open the app in App Store Connect.
2. Go to the `TestFlight` tab.
3. Fill in:
   - beta app description
   - feedback email
   - contact info
   - what to test

Then:

1. Create an internal testing group for your own smoke test.
2. Add the new build to that group.
3. Install it yourself through TestFlight and verify sign-in, core flows, and crash-free startup.

## 9. Add the 10 realtor testers

After the internal smoke test passes:

1. Create an external testing group.
2. Add the build to that group.
3. Submit the build for Beta App Review.
4. After approval, invite the 10 realtors by email.

Important:

- The first external TestFlight build usually requires Apple beta review.
- TestFlight builds expire after 90 days.

## 10. Ship follow-up fixes quickly

For each new beta iteration:

1. Make the fix.
2. Build a new iOS production build.
3. Submit it again to TestFlight.
4. Add it to the same tester group.

Command loop:

```bash
pnpm dlx eas-cli build --platform ios --profile production
pnpm dlx eas-cli submit --platform ios --profile production --latest
```

## Suggested rollout

Use this sequence:

1. Fix bundle identifier and Apple app record first.
2. Upload one internal-only TestFlight candidate and verify it yourself.
3. Move to external TestFlight once install, auth, and the main workflow are stable.
4. Keep the external group limited to the 10 realtors until the app stops producing high-severity issues.
