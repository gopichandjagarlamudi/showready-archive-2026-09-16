// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FeedbackList } from "./feedback-list"

describe("FeedbackList", () => {
  it("displays feedback entries with message, source, and links to agent detail", () => {
    render(
      <FeedbackList
        result={{
          items: [{
            id: "00000000-0000-4000-8000-000000000001",
            agentId: "00000000-0000-4000-8000-000000000002",
            agentFullName: "Morgan Agent",
            agentEmail: "morgan@example.com",
            source: "mobile-app",
            message: "App crashes on launch",
            createdAt: "2026-07-14T00:00:00.000Z"
          }],
          total: 1
        }}
      />
    )

    expect(screen.getByText("App crashes on launch")).toBeInTheDocument()
    expect(screen.getByText("mobile-app")).toBeInTheDocument()
    const agentLink = screen.getByRole("link", { name: /Morgan Agent/i })
    expect(agentLink).toHaveAttribute("href", "/users/00000000-0000-4000-8000-000000000002")
  })
})
