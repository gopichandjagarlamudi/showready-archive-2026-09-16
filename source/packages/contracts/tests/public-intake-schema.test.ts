import { describe, expect, it } from "vitest"
import { PublicIntakePayloadSchema } from "../src"

describe("public intake payload schema", () => {
  it("accepts bounded contact details and text answers", () => {
    expect(
      PublicIntakePayloadSchema.parse({
        draft: {
          contact: {
            fullName: " Taylor Verify ",
            email: " taylor@example.com ",
            phone: " +1 (416) 555-0101 "
          },
          intent: "buy",
          buyer: {
            neighborhoods: "Toronto",
            additionalContext: "Prefers west-end condos."
          },
          customAnswers: {
            message: "Available after 5pm."
          }
        },
        guard: {
          startedAt: Date.now() - 3000,
          website: ""
        }
      })
    ).toMatchObject({
      draft: {
        contact: {
          fullName: "Taylor Verify",
          email: "taylor@example.com",
          phone: "+1 (416) 555-0101"
        }
      }
    })
  })

  it("rejects spammy contact details and oversized messages", () => {
    expect(() =>
      PublicIntakePayloadSchema.parse({
        draft: {
          contact: {
            fullName: "https://spam.example",
            email: "taylor@example.com"
          }
        }
      })
    ).toThrow()

    expect(() =>
      PublicIntakePayloadSchema.parse({
        draft: {
          contact: {
            fullName: "Taylor Verify",
            phone: "call me<script>"
          }
        }
      })
    ).toThrow()

    expect(() =>
      PublicIntakePayloadSchema.parse({
        draft: {
          contact: {
            fullName: "Taylor Verify",
            email: "taylor@example.com"
          },
          buyer: {
            additionalContext: "x".repeat(1001)
          }
        }
      })
    ).toThrow()

    expect(() =>
      PublicIntakePayloadSchema.parse({
        draft: {
          contact: {
            fullName: "Taylor Verify",
            email: "taylor@example.com"
          },
          customAnswers: {
            message: "x".repeat(1001)
          }
        }
      })
    ).toThrow()
  })
})
