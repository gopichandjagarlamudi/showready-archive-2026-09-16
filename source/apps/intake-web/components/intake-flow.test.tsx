// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { IntakeFlow } from "./intake-flow"

const saleTemplate = {
  id: "sale-template",
  intakeType: "sale" as const,
  name: "ShowReady Buyer",
  introHeadline: "A quick step before your home search starts",
  introBody: "This takes about one minute.",
  customQuestions: []
}

const rentalTemplate = {
  id: "rental-template",
  intakeType: "rental" as const,
  name: "ShowReady Rental",
  introHeadline: "A quick step before your rental search starts",
  introBody: "This takes about one minute.",
  customQuestions: []
}

const branding = {
  realtorName: "Taylor Agent",
  brandLine: "Northline Realty",
  brandColor: "#24533f",
  accentColor: "#c45f2c"
}
const flowTransitionTimeout = 3000

function deferredResponse() {
  let resolve!: (value: { ok: boolean; json: () => Promise<{ ok: boolean }> }) => void
  const promise = new Promise<{ ok: boolean; json: () => Promise<{ ok: boolean }> }>((next) => {
    resolve = next
  })

  return {
    promise,
    resolve
  }
}

async function waitForStep(label: string) {
  await waitFor(
    () => {
      expect(screen.getByText(label)).toBeTruthy()
    },
    {
      timeout: flowTransitionTimeout
    }
  )
}

async function advanceUntilQuestion(label: string) {
  for (let index = 0; index < 25; index += 1) {
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Continue" }) ??
          screen.queryByRole("button", { name: "Submit" })
      ).toBeTruthy()
    })

    if (screen.queryByText(label)) {
      return
    }

    const currentQuestion = screen.getByRole("heading", { level: 2 }).textContent ?? ""
    const textbox = screen.queryByRole("textbox")

    if (textbox) {
      const inputType = textbox.getAttribute("type")
      fireEvent.change(textbox, {
        target: {
          value:
            inputType === "email"
              ? `buyer.${index}@example.com`
              : inputType === "tel"
                ? "416-555-0101"
                : `Answer ${index + 1}`
        }
      })
      fireEvent.click(screen.getByRole("button", { name: "Continue" }))
      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(currentQuestion)
      })
      continue
    }

    const optionButton = screen
      .queryAllByRole("button")
      .find((button) => !["Continue", "Skip", "Submit"].includes(button.textContent ?? ""))

    if (!optionButton) {
      throw new Error(`Could not determine how to advance toward "${label}".`)
    }

    fireEvent.click(optionButton)
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe(currentQuestion)
    })
  }

  throw new Error(`Did not reach "${label}" within the expected number of steps.`)
}

describe("IntakeFlow", () => {
  const fetchMock = vi.fn()
  const assignMock = vi.fn()

  function getLastPostedDraft() {
    const lastCall = fetchMock.mock.calls.at(-1)

    if (!lastCall) {
      throw new Error("Expected fetch to have been called.")
    }

    const [, init] = lastCall
    const body = init?.body

    if (typeof body !== "string") {
      throw new Error("Expected fetch body to be a JSON string.")
    }

    return JSON.parse(body).draft
  }

  beforeEach(() => {
    fetchMock.mockReset()
    assignMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    })
    vi.stubGlobal("fetch", fetchMock)
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: assignMock }
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("renders realtor-first branding and the ShowReady powered-by mark", () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    expect(screen.getByText("Presented by Taylor Agent")).toBeTruthy()
    expect(screen.getByText("Northline Realty")).toBeTruthy()
    expect(screen.getByText("Powered by ShowReady")).toBeTruthy()
    expect(screen.getByAltText("ShowReady")).toBeTruthy()
  })

  it("omits the brand line when realtor brokerage or team brand is missing", () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={{
          realtorName: "Taylor Agent",
          brandColor: "#24533f",
          accentColor: "#c45f2c"
        }}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    expect(screen.getByText("Presented by Taylor Agent")).toBeTruthy()
    expect(screen.queryByText("Northline Realty")).toBeNull()
    expect(screen.getByText("Powered by ShowReady")).toBeTruthy()
  })

  it("requires an email or phone before advancing past contact details", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 4")
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))

    await waitForStep("Step 3 of 4")

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(
      screen.getByText("Please add at least one contact method before continuing.")
    ).toBeTruthy()
  })

  it("does not call public intake APIs on initial render", () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows a retryable message when autosave has a network load failure", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Load failed"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true })
      })

    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 4")
    await waitFor(() => {
      expect(screen.getByText("Unable to save answer. Check your connection and try again.")).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))

    await waitForStep("Step 3 of 4")
  })

  it("moves to the next question while autosave finishes in the background", async () => {
    const autosave = deferredResponse()
    fetchMock.mockReturnValueOnce(autosave.promise)

    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 4")
    expect(screen.queryByRole("button", { name: "Saving..." })).toBeNull()

    autosave.resolve({
      ok: true,
      json: async () => ({ ok: true })
    })
  })

  it("expands to the intent-specific questions before submission", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 4")

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))

    await waitForStep("Step 3 of 4")

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "taylor@example.com" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 4 of 4")

    fireEvent.click(screen.getByRole("button", { name: "Buying a property" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/intake/invite-token/autosave",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("\"guard\"")
        })
      )
    })

    await waitForStep("Step 5 of 15")

    expect(
      screen.getByText("Are you looking to buy for yourself or as an investment?")
    ).toBeTruthy()
  })

  it("validates phone input before saving the public intake draft", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 4")

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "call me<script>" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(screen.getByText("Enter a valid phone number.")).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("submits when the last optional question is skipped", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={{
          ...saleTemplate,
          customQuestions: [
            {
              id: "timing",
              label: "When do you want to move?",
              helperText: "Skip if you are still flexible.",
              required: false,
              type: "text"
            }
          ]
        }}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Taylor Verify" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 2 of 5")

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))

    await waitForStep("Step 3 of 5")

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "taylor@example.com" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitForStep("Step 4 of 5")

    fireEvent.click(screen.getByRole("button", { name: "Buying a property" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await advanceUntilQuestion("When do you want to move?")

    fireEvent.click(screen.getByRole("button", { name: "Skip" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/intake/invite-token/submit",
        expect.objectContaining({
          method: "POST"
        })
      )
    })

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/intake/invite-token/complete")
    })
  })

  it("allows buyer property type to save multiple selected concrete choices", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    await advanceUntilQuestion("What type of property are you looking for?")

    fireEvent.click(screen.getByRole("button", { name: "Condo" }))
    fireEvent.click(screen.getByRole("button", { name: "Townhouse" }))
    expect(screen.queryByRole("button", { name: "Other" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(getLastPostedDraft().buyer.propertyType).toEqual(["condo", "townhouse"])
    })
  })

  it("allows rental place type to save multiple selected concrete choices", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    await advanceUntilQuestion("Are you buying a property or renting?")
    fireEvent.click(screen.getByRole("button", { name: "Renting" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await advanceUntilQuestion("What type of place are you looking for?")

    fireEvent.click(screen.getByRole("button", { name: "Condo" }))
    fireEvent.click(screen.getByRole("button", { name: "House" }))
    expect(screen.queryByRole("button", { name: "Not sure" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(getLastPostedDraft().rental.placeType).toEqual(["condo", "house"])
    })
  })

  it("uses a native date input for the preferred move-in date", async () => {
    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={saleTemplate}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    await advanceUntilQuestion("Are you buying a property or renting?")
    fireEvent.click(screen.getByRole("button", { name: "Renting" }))
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await advanceUntilQuestion("Do you have a preferred move-in date?")

    const dateInput = screen.getByLabelText("Do you have a preferred move-in date?")
    expect(dateInput.getAttribute("type")).toBe("date")

    fireEvent.change(dateInput, {
      target: { value: "2026-06-15" }
    })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    await waitFor(() => {
      expect(getLastPostedDraft().rental.preferredMoveInDate).toBe("2026-06-15")
    })
  })

  it("redirects to completion when a submit retry reports the intake is already submitted", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/submit")) {
        return {
          ok: false,
          json: async () => ({ error: "This intake has already been submitted." })
        }
      }

      return {
        ok: true,
        json: async () => ({ ok: true })
      }
    })

    render(
      <IntakeFlow
        token="invite-token"
        branding={branding}
        draft={{ contact: { fullName: "" } }}
        saleTemplate={{
          ...saleTemplate,
          customQuestions: [
            {
              id: "notes",
              label: "Anything else?",
              required: false,
              type: "text"
            }
          ]
        }}
        rentalTemplate={rentalTemplate}
        requiredQuestions={[]}
        optionalQuestions={[]}
      />
    )

    await advanceUntilQuestion("Anything else?")

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Already submitted on a previous tap." }
    })
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/intake/invite-token/complete")
    })
  })
})
