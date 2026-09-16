const {
  buildAndroidMaestroArgs,
  resolveAndroidMaestroEnv
} = require("./run-maestro-android.cjs")

describe("run maestro android", () => {
  it("uses Android emulator defaults for ShowReady smoke runs", () => {
    const authUrl = "showready://auth/callback?access_token=token&refresh_token=refresh"

    expect(resolveAndroidMaestroEnv({}, authUrl)).toEqual({
      APP_ID: "com.showready.mobile",
      APP_OPEN_URL:
        "showready://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081",
      AUTH_CALLBACK_URL: authUrl
    })
  })

  it("keeps explicit Maestro environment overrides", () => {
    const authUrl = "showready://auth/callback?access_token=token&refresh_token=refresh"

    expect(
      resolveAndroidMaestroEnv(
        {
          APP_ID: "com.example.custom",
          APP_OPEN_URL: "showready://custom-open",
          AUTH_CALLBACK_URL: "showready://custom-callback"
        },
        authUrl
      )
    ).toEqual({
      APP_ID: "com.example.custom",
      APP_OPEN_URL: "showready://custom-open",
      AUTH_CALLBACK_URL: "showready://custom-callback"
    })
  })

  it("passes app id, open url, and auth callback to Maestro", () => {
    const maestroEnv = {
      APP_ID: "com.showready.mobile",
      APP_OPEN_URL:
        "showready://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081",
      AUTH_CALLBACK_URL: "showready://auth/callback?access_token=token"
    }

    expect(buildAndroidMaestroArgs(".maestro/smoke-android.yaml", maestroEnv)).toEqual([
      "test",
      "-e",
      "APP_ID=com.showready.mobile",
      "-e",
      "APP_OPEN_URL=showready://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081",
      "-e",
      "AUTH_CALLBACK_URL=showready://auth/callback?access_token=token",
      ".maestro/smoke-android.yaml"
    ])
  })
})
