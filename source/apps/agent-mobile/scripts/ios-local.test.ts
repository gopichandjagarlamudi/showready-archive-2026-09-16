const {
  buildDoctorSummary,
  isFullXcodeDeveloperDir
} = require("./ios-local.cjs")

describe("ios local helper", () => {
  it("treats Command Line Tools as insufficient for simulator testing", () => {
    expect(isFullXcodeDeveloperDir("/Library/Developer/CommandLineTools")).toBe(false)
  })

  it("recognizes a full Xcode developer directory", () => {
    expect(isFullXcodeDeveloperDir("/Applications/Xcode.app/Contents/Developer")).toBe(true)
  })

  it("prints a concrete fix when full Xcode is missing", () => {
    expect(
      buildDoctorSummary({
        developerDir: "/Library/Developer/CommandLineTools",
        simctlAvailable: false
      })
    ).toContain("Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer")
  })
})
