import { expect, test, type Page } from "@playwright/test"

async function submitCurrentStep(page: Page) {
  await Promise.all([page.waitForURL(/\/complete$/), page.getByRole("button", { name: "Submit" }).click()])
}

async function continueToNextStep(page: Page, buttonName: "Continue" | "Skip") {
  const heading = page.getByRole("heading", { level: 2 })
  const currentHeading = await heading.textContent()

  await page.getByRole("button", { name: buttonName }).click()

  await expect(heading).not.toHaveText(currentHeading ?? "", {
    timeout: 10000
  })
}

async function advanceCurrentStep(page: Page, stepIndex: number) {
  const submitButton = page.getByRole("button", { name: "Submit" })
  const primaryAction = (await submitButton.isVisible()) ? "Submit" : "Continue"

  const input = page.locator("input").first()
  const textarea = page.locator("textarea").first()

  if (await input.isVisible()) {
    const type = await input.getAttribute("type")
    const answer =
      type === "email"
        ? `playwright.${Date.now()}@example.com`
        : type === "tel"
          ? "4165550101"
          : type === "date"
            ? "2026-06-15"
            : `Playwright step ${stepIndex + 1}`

    await input.fill(answer)
    if (primaryAction === "Submit") {
      await submitCurrentStep(page)
      return true
    }

    await continueToNextStep(page, "Continue")
    return false
  }

  if (await textarea.isVisible()) {
    await textarea.fill(`Playwright answer ${stepIndex + 1}`)
    if (primaryAction === "Submit") {
      await submitCurrentStep(page)
      return true
    }

    await continueToNextStep(page, "Continue")
    return false
  }

  const buttons = page.getByRole("button")
  const labels = (await buttons.allTextContents()).map((text: string) => text.trim())
  const optionIndex = labels.findIndex((label: string) => !["Continue", "Skip", "Submit"].includes(label))

  if (optionIndex >= 0) {
    await buttons.nth(optionIndex).click()
    if (primaryAction === "Submit") {
      const continueButton = page.getByRole("button", { name: "Continue" })

      try {
        await expect(continueButton).toBeVisible({ timeout: 2000 })
        await continueToNextStep(page, "Continue")
        return false
      } catch {
        await submitCurrentStep(page)
        return true
      }
    }

    await continueToNextStep(page, "Continue")
    return false
  }

  if (await page.getByRole("button", { name: "Skip" }).isVisible()) {
    await continueToNextStep(page, "Skip")
    return false
  }

  if (primaryAction === "Submit") {
    await submitCurrentStep(page)
    return true
  }

  throw new Error("Playwright e2e could not determine how to answer the current intake step.")
}

test("live intake invite reaches the completion page", async ({ page }) => {
  const token = process.env.PLAYWRIGHT_INTAKE_TOKEN

  if (!token) {
    throw new Error("Missing PLAYWRIGHT_INTAKE_TOKEN from global setup.")
  }

  await page.goto(`/intake/${token}`)
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible()

  for (let index = 0; index < 30; index += 1) {
    if (await advanceCurrentStep(page, index)) {
      break
    }
  }

  await expect(page).toHaveURL(new RegExp(`/intake/${token}/complete$`))
})
