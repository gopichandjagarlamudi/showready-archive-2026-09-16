import { describe, expect, it } from "vitest"
import { createAdminServerErrorRow } from "./observability"

it("redacts email, bearer tokens, and query values before storing an admin error", () => {
  const row = createAdminServerErrorRow(new Error("user@example.com Bearer secret-token"), {
    path: "/users?email=user@example.com",
    method: "GET",
    route: "admin.users"
  })

  expect(row.message).not.toContain("user@example.com")
  expect(row.message).not.toContain("secret-token")
  expect(row.path).toBe("/users")
})
