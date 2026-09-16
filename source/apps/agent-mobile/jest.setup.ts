jest.mock("@expo/vector-icons", () => {
  const React = require("react")
  const { Text } = require("react-native")

  function Icon(props: { name?: string }) {
    return React.createElement(Text, null, props.name ?? "icon")
  }

  return {
    Feather: Icon
  }
})

jest.mock("expo-linear-gradient", () => {
  const React = require("react")
  const { View } = require("react-native")

  return {
    LinearGradient: (props: Record<string, unknown>) => React.createElement(View, props)
  }
})

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[mock]" })),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: jest.fn()
  }))
}))

jest.mock("@react-native-async-storage/async-storage", () => {
  const values = new Map<string, string>()

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value)
      }),
      removeItem: jest.fn(async (key: string) => {
        values.delete(key)
      })
    }
  }
})

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "0.1.0"
    },
    nativeAppVersion: "0.1.0",
    nativeBuildVersion: "1"
  }
}))
