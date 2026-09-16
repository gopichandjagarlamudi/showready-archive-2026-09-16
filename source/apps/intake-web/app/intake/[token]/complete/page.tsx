import {
  IntakeCompletionMessage,
  IntakeStatusPage
} from "@/components/intake-branding"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPublicLeadIntakeContext } from "@/lib/supabase/data"
import type { PublicIntakeBranding } from "@/lib/public-intake-branding"

async function getCompletionBranding(token: string): Promise<PublicIntakeBranding> {
  try {
    const context = await getPublicLeadIntakeContext(createSupabaseAdminClient(), token)
    return context?.branding ?? {}
  } catch {
    return {}
  }
}

export default async function IntakeCompletePage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const branding = await getCompletionBranding(token)

  return (
    <IntakeStatusPage
      branding={branding}
      eyebrow="Submission received"
      title="You’re officially in the queue."
    >
      <IntakeCompletionMessage branding={branding} />
    </IntakeStatusPage>
  )
}
