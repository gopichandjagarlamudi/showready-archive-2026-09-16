# Mobile Header And Navigation Design

Date: 2026-05-07
Status: Approved for implementation planning

## Context

The ShowReady mobile app currently uses a large custom hero header through `ScreenShell`.
Only the Field Dashboard page exposes the settings action. New Leads, Pipeline, and
Appointments do not show a settings icon, even though settings exists as a hidden tab route.

Lead details currently use an in-content full-width "Back to leads" action. This works, but
it feels less native on iOS than a top-left chevron and left-edge swipe back.

The approved direction is Option C from the brainstorming review: a compact operational shell,
with the native detail navigation behavior from Option B.

## Goals

- Show the settings icon on every top-level app page.
- Reduce oversized top-level page titles so the app feels like a working field CRM, not a
  landing page.
- Keep ShowReady branding present without letting the header consume too much vertical space.
- Replace the lead detail full-width back button with an iOS-style back chevron.
- Enable native iOS left-edge swipe back for lead detail where the navigation stack supports it.
- Preserve accessibility, discoverability, and Android behavior.

## Non-Goals

- Redesign the tab bar.
- Change lead, appointment, or pipeline data behavior.
- Add new settings features.
- Redesign cards, sheets, filters, or lead actions beyond spacing needed to support the header
  and navigation changes.

## Design Direction

### Top-Level Screen Shell

Use a compact operational header for Field Dashboard, New Leads, Pipeline, Appointments, and
Settings. The header should still show the ShowReady lockup and a utility action area, but the
page title should move closer to iOS large-title scale.

Recommended title treatment:

- Page title font size around 30-34 on phone layouts.
- Line height around 36-40.
- Weight remains strong, but not hero-scale.
- Subtitle text, when present, should use body or subheadline scale around 15-17.
- Header vertical gap should be reduced so the first useful card or list content appears sooner.

The settings icon should be available as a top-right circular icon button on all top-level pages.
It should route to the existing hidden `settings` tab route. Use the existing `ScreenShell`
`headerAction` pattern unless the implementation creates a small shared helper for the repeated
settings action.

### Lead Detail Navigation

Lead detail should use a visible top-left iOS-style chevron as the back affordance. The existing
full-width "Back to leads" button should be removed from the detail body.

The chevron should:

- Sit in the header or a compact top bar, not inside the card content.
- Use a system-like left chevron icon.
- Have an accessible label such as "Back to leads".
- Call the existing back fallback behavior: `router.back()` when possible, otherwise replace to a
  safe app destination.

Native stack gestures should be enabled for the lead detail route so iOS users can left-edge swipe
to go back. The chevron remains necessary for discoverability, accessibility, and users who do not
use gestures.

### Settings Access

Settings should remain hidden from the bottom tab bar. It is a utility destination rather than a
primary workflow destination.

Each top-level screen should expose settings in the same location and style:

- Field Dashboard
- New Leads
- Pipeline
- Appointments

Settings itself can either omit the settings icon or use a disabled/current-page treatment if the
shared shell makes omission awkward. Preferred behavior is to omit the icon on Settings because the
user is already there.

## iOS UX Rules Applied

- Clarity: use compact, legible titles and precise icon-only controls with accessibility labels.
- Deference: reduce header dominance so lead and appointment content becomes the focus.
- Depth: use stack navigation for detail pages rather than an in-content back command.
- Platform fit: support the familiar iOS back chevron and left-edge swipe while preserving a
  visible fallback.
- Dynamic Type: prefer semantic or tokenized typography values and avoid fixed layouts that break
  when text grows.

## Implementation Notes

- Update `ScreenShell` typography and spacing tokens locally or through `mobileTheme` if the app
  already centralizes mobile typography there.
- Add settings `headerAction` to `new-leads`, `pipeline`, and `appointments`, matching the existing
  Home implementation.
- Consider extracting a small `useSettingsHeaderAction` or `settingsHeaderAction(router)` helper if
  repeated object literals become noisy.
- Configure the root `Stack` or the `lead/[id]` screen options so native gestures remain enabled.
  Keep `headerShown: false` if the custom header stays, but do not disable stack gestures.
- Update lead detail layout to render a compact back chevron in the shell/header area and remove the
  full-width back button from the body.
- Preserve the current fallback behavior when no navigation history exists.

## Testing Plan

- Unit tests:
  - `ScreenShell` still renders title, subtitle, and header actions.
  - Home, New Leads, Pipeline, and Appointments expose settings buttons.
  - Lead detail exposes a back chevron button and no longer renders the full-width back button.
  - App tab layout still keeps Settings hidden from bottom navigation.

- Manual mobile verification:
  - On iOS, open a lead from New Leads, Pipeline, and Home, then swipe from the left edge to return.
  - Tap the chevron on lead detail and verify the same fallback behavior works.
  - Open settings from each top-level page.
  - Check the compact title treatment on small phone and larger simulator sizes.
  - Check light and dark mode if the app theme supports it.

## Risks And Mitigations

- Gesture behavior may differ between Expo Router stack groups and direct routes.
  Mitigation: verify on an iOS simulator or device, not only unit tests.

- Repeated settings action objects can drift between screens.
  Mitigation: use a shared helper if it improves consistency without adding unnecessary abstraction.

- Reducing title size could weaken brand presence.
  Mitigation: keep the ShowReady lockup in the header, but let page content carry the workflow.

## Acceptance Criteria

- Settings icon appears on Field Dashboard, New Leads, Pipeline, and Appointments.
- Settings remains hidden from the bottom tab bar.
- Top-level page titles are visibly smaller and consume less vertical space.
- Lead detail uses a visible iOS-style chevron for back navigation.
- The full-width "Back to leads" button is removed from lead detail content.
- iOS left-edge swipe back works on lead detail.
- Existing lead review, pipeline, appointment, and settings flows are unchanged.
