const appConfig = require("../app.json")
const easConfig = require("../eas.json")

describe("release configuration", () => {
  it("declares the iOS privacy manifest in Expo config for EAS builds", () => {
    const privacyManifests = appConfig.expo.ios.privacyManifests

    expect(privacyManifests.NSPrivacyTracking).toBe(false)
    expect(
      privacyManifests.NSPrivacyAccessedAPITypes.map(
        (entry: { NSPrivacyAccessedAPIType: string }) => entry.NSPrivacyAccessedAPIType
      )
    ).toEqual(
      expect.arrayContaining([
        "NSPrivacyAccessedAPICategoryFileTimestamp",
        "NSPrivacyAccessedAPICategoryUserDefaults",
        "NSPrivacyAccessedAPICategoryDiskSpace",
        "NSPrivacyAccessedAPICategorySystemBootTime"
      ])
    )
    expect(
      privacyManifests.NSPrivacyCollectedDataTypes.map(
        (entry: { NSPrivacyCollectedDataType: string }) => entry.NSPrivacyCollectedDataType
      )
    ).toEqual(
      expect.arrayContaining([
        "NSPrivacyCollectedDataTypeName",
        "NSPrivacyCollectedDataTypeEmailAddress",
        "NSPrivacyCollectedDataTypePhoneNumber",
        "NSPrivacyCollectedDataTypeDeviceID",
        "NSPrivacyCollectedDataTypeCrashData"
      ])
    )
  })

  it("pins iOS App Store builds to the SDK 54 Xcode 26 image", () => {
    expect(easConfig.build.production.ios.image).toBe("sdk-54")
  })

  it("uses the deployed mobile API host for EAS Android builds", () => {
    const expectedApiBaseUrl = "https://showready-intake-web.vercel.app"

    expect(easConfig.build.development.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedApiBaseUrl)
    expect(easConfig.build.preview.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedApiBaseUrl)
    expect(easConfig.build.production.env.EXPO_PUBLIC_API_BASE_URL).toBe(expectedApiBaseUrl)
  })

  it("declares Android launch identifiers, hardening, and build artifact formats", () => {
    expect(appConfig.expo.scheme).toBe("showready")
    expect(appConfig.expo.android.package).toBe("com.showready.mobile")
    expect(appConfig.expo.android.allowBackup).toBe(false)
    expect(appConfig.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW"
      ])
    )

    expect(easConfig.build.development.android.buildType).toBe("apk")
    expect(easConfig.build.preview.android.buildType).toBe("apk")
    expect(easConfig.build.production.android.buildType).toBe("app-bundle")
  })

  it("configures Android Play submit tracks for internal testing and staged production rollout", () => {
    expect(easConfig.submit.internal.android).toEqual({
      track: "internal",
      releaseStatus: "completed"
    })
    expect(easConfig.submit.production.android).toEqual({
      track: "production",
      releaseStatus: "inProgress",
      rollout: 0.1
    })
  })

  it("uses the canonical public site for every EAS profile", () => {
    const expectedSiteUrl = "https://showreadyapp.com"
    expect(easConfig.build.development.env.EXPO_PUBLIC_SITE_URL).toBe(
      expectedSiteUrl,
    )
    expect(easConfig.build.preview.env.EXPO_PUBLIC_SITE_URL).toBe(expectedSiteUrl)
    expect(easConfig.build.production.env.EXPO_PUBLIC_SITE_URL).toBe(
      expectedSiteUrl,
    )
  })
})
