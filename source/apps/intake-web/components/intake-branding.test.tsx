// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { IntakeCompletionMessage, IntakeStatusPage } from "./intake-branding"

const branding = {
  realtorName: "Taylor Agent",
  brandLine: "Northline Realty",
  brandColor: "#24533f",
  accentColor: "#c45f2c"
}

describe("intake branding components", () => {
  it("renders a realtor-branded status page with the ShowReady powered-by mark", () => {
    render(
      <IntakeStatusPage
        branding={branding}
        eyebrow="Invite expired"
        title="This intake link has expired."
      >
        <p>Please request a fresh invite from your agent.</p>
      </IntakeStatusPage>
    )

    expect(screen.getByText("Presented by Taylor Agent")).toBeTruthy()
    expect(screen.getByText("Northline Realty")).toBeTruthy()
    expect(screen.getByText("Powered by ShowReady")).toBeTruthy()
    expect(screen.getByAltText("ShowReady")).toBeTruthy()
  })

  it("falls back to generic completion copy when realtor name is missing", () => {
    render(<IntakeCompletionMessage branding={{}} />)

    expect(
      screen.getByText(
        "Your agent now has the information they need to review your readiness, score the next best move, and follow up with a tailored plan."
      )
    ).toBeTruthy()
  })

  it("personalizes completion copy with the realtor name when available", () => {
    render(<IntakeCompletionMessage branding={branding} />)

    expect(
      screen.getByText(
        "Taylor Agent now has the information they need to review your readiness, score the next best move, and follow up with a tailored plan."
      )
    ).toBeTruthy()
  })
})
