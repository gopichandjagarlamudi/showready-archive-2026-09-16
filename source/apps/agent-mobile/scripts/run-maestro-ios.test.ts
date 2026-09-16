const { resolveDeveloperDir } = require("./run-maestro-ios.cjs")

describe("run maestro ios", () => {
  it("keeps an explicit developer dir when one is already configured", () => {
    expect(
      resolveDeveloperDir({
        DEVELOPER_DIR: "/Custom/Xcode.app/Contents/Developer"
      })
    ).toBe("/Custom/Xcode.app/Contents/Developer")
  })

  it("uses the full Xcode developer dir when the default app exists", () => {
    expect(resolveDeveloperDir({}, true)).toBe("/Applications/Xcode.app/Contents/Developer")
  })

  it("does not force a developer dir when Xcode is unavailable", () => {
    expect(resolveDeveloperDir({}, false)).toBeUndefined()
  })
})
