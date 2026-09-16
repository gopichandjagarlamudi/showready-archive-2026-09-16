import { IntakeFlow } from "@/components/intake-flow"
import { IntakeStatusPage } from "@/components/intake-branding"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPublicLeadIntakeContext } from "@/lib/supabase/data"

export default async function IntakePage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createSupabaseAdminClient()
  const context = await getPublicLeadIntakeContext(supabase, token)

  if (!context) {
    return (
      <IntakeStatusPage branding={{}} eyebrow="Invite not found" title="Invite not found">
        <p>This invite may have expired or already been removed.</p>
      </IntakeStatusPage>
    )
  }

  if (context.isExpired) {
    return (
      <IntakeStatusPage
        branding={context.branding}
        eyebrow="Invite expired"
        title="Invite expired"
      >
        <p>This intake link has expired. Please request a fresh invite from your agent.</p>
      </IntakeStatusPage>
    )
  }

  return (
    <IntakeFlow
      token={token}
      branding={context.branding}
      draft={context.draft}
      saleTemplate={context.templates.sale}
      rentalTemplate={context.templates.rental}
      requiredQuestions={context.questions.required}
      optionalQuestions={context.questions.optional}
    />
  )
}
