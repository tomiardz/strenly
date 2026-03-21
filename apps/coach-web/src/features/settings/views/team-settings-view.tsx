import { Plus } from 'lucide-react'
import { useState } from 'react'
import { InviteMemberDialog } from '../components/invite-member-dialog'
import { MemberList } from '../components/member-list'
import { PendingInvitations } from '../components/pending-invitations'
import { useOrgMembers } from '../hooks/use-org-members'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { useUserRole } from '@/hooks/use-user-role'

/**
 * Team settings view.
 * Follows profile-view.tsx structure: heading + description + content.
 * Displays org members in a table with loading and error states.
 */
export function TeamSettingsView() {
  const { members, invitations, isLoading, error } = useOrgMembers()
  const { role, canInviteMembers, canUpdateRoles, canRemoveMembers } = useUserRole()
  const { user } = useAuth()
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

      <PendingInvitations invitations={invitations} isLoading={isLoading} canInviteMembers={canInviteMembers} />

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium text-destructive text-sm">Error al cargar los miembros</p>
          <p className="mt-1 text-muted-foreground text-sm">
            No se pudieron cargar los miembros de la organizacion. Intenta recargar la pagina.
          </p>
        </div>
      ) : (
        <MemberList
          members={members}
          isLoading={isLoading}
          currentUserId={user.id}
          canUpdateRoles={canUpdateRoles}
          canRemoveMembers={canRemoveMembers}
        />
      )}

      {canInviteMembers && (
        <InviteMemberDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} isOwner={role === 'owner'} />
      )}
    </div>
  )
}
