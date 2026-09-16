// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { UserList } from "./user-list"

describe("UserList", () => {
  it("renders account and aggregate fields without any lead/client columns", () => {
    render(
      <UserList
        result={{
          items: [{
            id: "00000000-0000-4000-8000-000000000001",
            fullName: "Morgan Agent",
            email: "morgan@example.com",
            brokerage: "North Realty",
            joinedAt: "2026-07-01T00:00:00.000Z",
            lastTrackedActivityAt: "2026-07-14T00:00:00.000Z",
            leadCount: 3,
            submittedIntakeCount: 2,
            appointmentCount: 1
          }],
          total: 1
        }}
      />
    )

    expect(screen.getByText("Morgan Agent")).toBeInTheDocument()
    expect(screen.getByText("morgan@example.com")).toBeInTheDocument()
    expect(screen.queryByText(/client|buyer|phone|address/i)).not.toBeInTheDocument()
  })
})
