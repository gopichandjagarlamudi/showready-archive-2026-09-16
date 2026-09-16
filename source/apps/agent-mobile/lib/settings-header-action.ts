import { router } from "expo-router"
import type { ScreenHeaderAction } from "@/components/screen-shell"

export function settingsHeaderAction(testID: string): ScreenHeaderAction {
  return {
    icon: "settings",
    label: "Open settings",
    onPress: () => router.push("/settings"),
    testID
  }
}
