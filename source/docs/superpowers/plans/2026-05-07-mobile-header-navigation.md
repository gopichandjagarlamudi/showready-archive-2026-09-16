# Mobile Header Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved compact iOS-style mobile header, settings access on every primary tab, and chevron plus gesture-ready lead detail navigation.

**Architecture:** Keep the existing Expo Router structure and `ScreenShell` custom header. Add a reusable settings header action helper, add optional leading header action support to `ScreenShell`, and enable native stack gestures for lead detail while preserving `headerShown: false`.

**Tech Stack:** Expo Router, React Native, Jest, `@testing-library/react-native`, `@showready/design-system`.

**Execution Status:** Completed inline. Focused tests, full agent-mobile Jest, and agent-mobile TypeScript checks passed.

---

## File Structure

- Modify `packages/design-system/src/index.ts`: reduce the mobile `title` token to iOS large-title scale.
- Modify `apps/agent-mobile/components/screen-shell.tsx`: compact header spacing and add optional leading action.
- Create `apps/agent-mobile/lib/settings-header-action.ts`: shared settings action object for primary tab screens.
- Modify `apps/agent-mobile/app/(app)/home.tsx`: use shared settings action.
- Modify `apps/agent-mobile/app/(app)/new-leads.tsx`: show settings action.
- Modify `apps/agent-mobile/app/(app)/pipeline.tsx`: show settings action.
- Modify `apps/agent-mobile/app/(app)/appointments.tsx`: show settings action.
- Modify `apps/agent-mobile/app/lead/[id].tsx`: move back affordance into a leading chevron and remove full-width body button.
- Modify `apps/agent-mobile/app/_layout.tsx`: configure the lead detail stack route with native gesture options.
- Modify tests under `apps/agent-mobile/tests` and `apps/agent-mobile/components` to cover the new UI behavior.

### Task 1: Failing Tests

**Files:**
- Modify: `apps/agent-mobile/tests/mobile-typography.test.ts`
- Modify: `apps/agent-mobile/components/screen-shell.test.tsx`
- Modify: `apps/agent-mobile/tests/home-screen.test.tsx`
- Modify: `apps/agent-mobile/tests/new-leads-screen.test.tsx`
- Modify: `apps/agent-mobile/tests/pipeline-screen.test.tsx`
- Modify: `apps/agent-mobile/tests/appointments-screen.test.tsx`
- Modify: `apps/agent-mobile/tests/lead-detail-screen.test.tsx`
- Create: `apps/agent-mobile/tests/app-root-layout.test.tsx`

- [ ] **Step 1: Add expectations for compact title scale**

```ts
expect(mobileTheme.typography.title).toBeGreaterThanOrEqual(30)
expect(mobileTheme.typography.title).toBeLessThanOrEqual(34)
```

- [ ] **Step 2: Add shell leading action coverage**

```tsx
<ScreenShell title="Lead detail" leadingAction={{ icon: "chevron-left", label: "Back to leads", onPress, testID: "lead-back-chevron" }}>
  <></>
</ScreenShell>
```

- [ ] **Step 3: Add settings action coverage for Home, New Leads, Pipeline, and Appointments**

```ts
fireEvent.press(await screen.findByTestId("new-leads-settings-button"))
expect(router.push).toHaveBeenCalledWith("/settings")
```

- [ ] **Step 4: Add lead detail chevron coverage**

```ts
expect(screen.queryByTestId("lead-back-button")).toBeNull()
fireEvent.press(screen.getByTestId("lead-back-chevron"))
expect(router.back).toHaveBeenCalledTimes(1)
```

- [ ] **Step 5: Add root stack gesture coverage**

```ts
expect(screenCalls.find((screen) => screen.name === "lead/[id]")?.options).toMatchObject({
  gestureEnabled: true
})
```

- [ ] **Step 6: Run focused tests and verify they fail before production edits**

Run: `pnpm --filter @showready/agent-mobile test -- mobile-typography screen-shell home-screen new-leads-screen pipeline-screen appointments-screen lead-detail-screen app-root-layout`

Expected: failures for missing compact title token, missing leading action prop, missing settings buttons, missing lead chevron, and missing lead stack options.

### Task 2: Header And Settings Implementation

**Files:**
- Modify: `packages/design-system/src/index.ts`
- Modify: `apps/agent-mobile/components/screen-shell.tsx`
- Create: `apps/agent-mobile/lib/settings-header-action.ts`
- Modify: primary tab screen files

- [ ] **Step 1: Set mobile title token to compact large-title scale**

```ts
typography: {
  eyebrow: 12,
  body: 17,
  bodySmall: 15,
  title: 34,
  section: 28
}
```

- [ ] **Step 2: Add shared settings action helper**

```ts
export function settingsHeaderAction(testID: string): ScreenHeaderAction {
  return {
    icon: "settings",
    label: "Open settings",
    onPress: () => router.push("/settings"),
    testID
  }
}
```

- [ ] **Step 3: Add `leadingAction` to `ScreenShell` and compact styles**

Render an optional left header button before the ShowReady lockup and reduce title, subtitle, content, and action sizing.

- [ ] **Step 4: Use `settingsHeaderAction()` on Home, New Leads, Pipeline, and Appointments**

Each primary screen passes its own stable test ID, for example `settingsHeaderAction("pipeline-settings-button")`.

### Task 3: Lead Detail Navigation And Stack Gesture

**Files:**
- Modify: `apps/agent-mobile/app/lead/[id].tsx`
- Modify: `apps/agent-mobile/app/_layout.tsx`

- [ ] **Step 1: Replace body back button with leading chevron**

```tsx
<ScreenShell
  title={lead?.buyerName ?? "Lead detail"}
  testID="lead-detail-screen"
  leadingAction={{
    icon: "chevron-left",
    label: "Back to leads",
    onPress: handleBack,
    testID: "lead-back-chevron"
  }}
>
```

- [ ] **Step 2: Configure lead stack gestures**

```tsx
<Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
  <Stack.Screen name="lead/[id]" options={{ gestureEnabled: true }} />
</Stack>
```

### Task 4: Verification

- [ ] **Step 1: Run focused Jest tests**

Run: `pnpm --filter @showready/agent-mobile test -- mobile-typography screen-shell home-screen new-leads-screen pipeline-screen appointments-screen lead-detail-screen app-root-layout`

Expected: all focused tests pass.

- [ ] **Step 2: Run mobile typecheck**

Run: `pnpm --filter @showready/agent-mobile typecheck`

Expected: TypeScript exits with code 0.

- [ ] **Step 3: Review dirty worktree**

Run: `git diff -- apps/agent-mobile packages/design-system docs/superpowers/plans/2026-05-07-mobile-header-navigation.md`

Expected: diff only contains the approved header/navigation implementation plus pre-existing local edits already present in touched files.
