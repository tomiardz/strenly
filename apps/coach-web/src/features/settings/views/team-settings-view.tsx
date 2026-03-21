import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUserRole } from '@/hooks/use-user-role'
import { InviteMemberDialog } from '../components/invite-member-dialog'
import { MemberList } from '../components/member-list'
import { useOrgMembers } from '../hooks/use-org-members'

/**
 * Team settings view.
 * Follows profile-view.tsx structure: heading + description + content.
 * Displays org members in a table with loading and error states.
 */
export function TeamSettingsView() {
  const { members, isLoading, error } = useOrgMembers()
  const { role, canInviteMembers } = useUserRole()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl">Equipo</h1>
          <p className="text-muted-foreground text-sm">Miembros de tu organizacion.</p>
        </div>
        {canInviteMembers && (
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Invitar
          </Button>
        )}
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-destructive text-sm">Error al cargar los miembros</p>
          <p className="mt-1 text-muted-foreground text-sm">
            No se pudieron cargar los miembros de la organizacion. Intenta recargar la pagina.
          </p>
        </div>
      ) : (
        <MemberList members={members} isLoading={isLoading} />
      )}

      {canInviteMembers && (
        <InviteMemberDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          isOwner={role === 'owner'}
        />
      )}
    </div>
  )
}
