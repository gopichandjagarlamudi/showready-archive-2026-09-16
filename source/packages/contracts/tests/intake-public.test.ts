import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  DEFAULT_TEMPLATES,
  getOptionalQuestionsForIntent,
  getRequiredQuestionsForIntent,
  intentToIntakeType,
  intakeTypeToIntent,
  resolveTemplateForIntakeType
} from "@showready/contracts/intake-public"

describe("@showready/contracts/intake-public", () => {
  it("exposes intake form data and helpers without importing server/admin schemas", () => {
    expect(intentToIntakeType("buy")).toBe("sale")
    expect(intakeTypeToIntent("rental")).toBe("rent")
    expect(getRequiredQuestionsForIntent("buy")).toContainEqual(
      expect.objectContaining({ key: "buyer.buyingFor" })
    )
    expect(getOptionalQuestionsForIntent("rent")).toContainEqual(
      expect.objectContaining({ key: "rental.preferredMoveInDate" })
    )
    expect(resolveTemplateForIntakeType("sale", [DEFAULT_TEMPLATES.sale]).name).toBe(
      "ShowReady Buyer"
    )
  })

  it("does not import zod or dashboard/mobile schemas into the public intake subpath", async () => {
    const source = await readFile(
      fileURLToPath(new URL("../src/intake-public.ts", import.meta.url)),
      "utf8"
    )

    expect(source).not.toContain("from \"zod\"")
    expect(source).not.toContain("DashboardSummarySchema")
    expect(source).not.toContain("DiagnosticsBatchSchema")
    expect(source).not.toContain("AppointmentMutationSchema")
  })
})
