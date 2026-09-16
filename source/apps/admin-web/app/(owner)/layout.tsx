import { requireAdminPage } from "@/lib/auth"
import { AdminShell } from "@/components/admin-shell"

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  return <AdminShell>{children}</AdminShell>
}
