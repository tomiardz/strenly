import { OrgNameForm } from '../components/org-name-form'
import { useUpdateOrg } from '../hooks/use-update-org'
import { useOrganization } from '@/contexts/organization-context'
import { useUserRole } from '@/hooks/use-user-role'

/**
 * General organization settings view.
 * Follows profile-view.tsx structure: heading + description + form.
 * Non-managers see the form in disabled/read-only state.
 */
export function GeneralSettingsView() {
  const org = useOrganization()
  const { canManageOrg } = useUserRole()
  const { updateOrg, isPending } = useUpdateOrg()

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl">General</h1>
        <p className="text-muted-foreground text-sm">Configura los detalles de tu organizacion.</p>
      </div>

      <div className="max-w-lg">
        <OrgNameForm
          onSubmit={updateOrg}
          defaultValues={{ name: org.name, slug: org.slug }}
          isSubmitting={isPending}
          disabled={!canManageOrg}
        />
      </div>
    </div>
  )
}
