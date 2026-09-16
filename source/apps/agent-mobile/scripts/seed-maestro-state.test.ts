const {
  DEMO_AGENT_ID,
  findDemoUser
} = require("./seed-maestro-state.cjs")

describe("seed maestro state", () => {
  it("reuses the fixed demo auth id even when the requested email changed", () => {
    const users = [
      {
        id: DEMO_AGENT_ID,
        email: "demo@showready.local"
      },
      {
        id: "other-user",
        email: "maestro.ios.codex@example.com"
      }
    ]

    expect(findDemoUser(users, "new.maestro@example.com")).toEqual(users[0])
    expect(findDemoUser(users, "maestro.ios.codex@example.com")).toEqual(users[1])
  })
})
