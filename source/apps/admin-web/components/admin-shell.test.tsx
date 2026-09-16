// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AdminShell } from "./admin-shell"

describe("AdminShell", () => {
  it("renders three navigation links to /, /users, and /feedback", () => {
    render(<AdminShell>content</AdminShell>)

    const overviewLink = screen.getByRole("link", { name: /overview|dashboard/i })
    const usersLink = screen.getByRole("link", { name: /users|agents/i })
    const feedbackLink = screen.getByRole("link", { name: /feedback/i })

    expect(overviewLink).toHaveAttribute("href", "/")
    expect(usersLink).toHaveAttribute("href", "/users")
    expect(feedbackLink).toHaveAttribute("href", "/feedback")
  })
})
