import { sanitizeDiagnosticsMetadata, sanitizeDiagnosticsText, sanitizeDiagnosticsPath } from "./redaction"

describe("sanitizeDiagnosticsMetadata", () => {
  it("removes blocked keys recursively while preserving safe debugging context", () => {
    expect(
      sanitizeDiagnosticsMetadata({
        route: "/home",
        leadId: "lead-1",
        email: "buyer@example.com",
        notes: "private note",
        nested: {
          authToken: "secret-token",
          pipelineStage: "ready_to_show"
        },
        crumbs: [
          {
            address: "123 Test Street",
            route: "/pipeline"
          }
        ]
      })
    ).toEqual({
      route: "/home",
      leadId: "lead-1",
      nested: {
        pipelineStage: "ready_to_show"
      },
      crumbs: [
        {
          route: "/pipeline"
        }
      ]
    })
  })

  it("redacts sensitive patterns from diagnostic string values", () => {
    expect(
      sanitizeDiagnosticsMetadata({
        message: "Failed buyer@example.com with Bearer production-token and phone 416-555-0101",
        nested: {
          stack: "Error: token=secret-token for buyer@example.com"
        }
      })
    ).toEqual({
      message: "Failed [redacted-email] with Bearer [redacted] and phone [redacted-phone]",
      nested: {
        stack: "Error: token=[redacted] for [redacted-email]"
      }
    })
  })

  it("normalizes diagnostic request paths without query values", () => {
    expect(
      sanitizeDiagnosticsPath("/api/mobile/pipeline/leads?query=buyer@example.com&limit=25&offset=0")
    ).toBe("/api/mobile/pipeline/leads?limit&offset&query")
    expect(sanitizeDiagnosticsText("Call +1 (416) 555-0101 for buyer@example.com")).toBe(
      "Call [redacted-phone] for [redacted-email]"
    )
  })
})
