import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useUpdateMemberRole } from '../hooks/use-update-member-role'
import { RemoveMemberDialog } from './remove-member-dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/toast'

type Member = {
  id: string
  userId: string
  role: string
  user: {
    name: string
    email: string
    image?: string | null
  }
}

type MemberActionsProps = {
  member: Member
  currentUserId: string
  canUpdateRoles: boolean
  canRemoveMembers: boolean
  ownerCount: number
}

const roleItems = [
  { value: 'owner', label: 'Propietario' },
  { value: 'manager', label: 'Manager' },
  { value: 'coach', label: 'Coach' },
]

/**
 * Actions for a member row: inline role Select and remove button.
 * - Role select: visible when canUpdateRoles and not own row
 * - Remove button: visible when canRemoveMembers
 * - Prevents changing own role or last owner's role
 * - Prevents removing self (shows toast)
 * - Prevents removing last owner (shows toast)
 */
export function MemberActions({
  member,
  currentUserId,
  canUpdateRoles,
  canRemoveMembers,
  ownerCount,
}: MemberActionsProps) {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const updateRole = useUpdateMemberRole()

  const isSelf = member.userId === currentUserId
  const isLastOwner = member.role === 'owner' && ownerCount <= 1

  const handleRoleChange = (value: string | null) => {
    if (!value) return
    if (isSelf) {
      toast.error('No puedes cambiar tu propio rol')
      return
    }
    if (isLastOwner) {
      toast.error('No puedes cambiar el rol del ultimo propietario')
      return
    }
    updateRole.mutate({ memberId: member.id, role: value })
  }

  const handleRemoveClick = () => {
    if (isSelf) {
      toast.error('No puedes eliminarte a ti mismo')
      return
    }
    if (isLastOwner) {
      toast.error('No puedes eliminar al ultimo propietario')
      return
    }
    setRemoveDialogOpen(true)
  }

  return (
    <div className="flex items-center gap-2">
      {canUpdateRoles && !isSelf && (
        <Select
          value={member.role}
          onValueChange={handleRoleChange}
          disabled={updateRole.isPending || isLastOwner}
          items={roleItems}
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            {roleItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {canRemoveMembers && (
        <>
          <Button variant="ghost" size="icon" onClick={handleRemoveClick} aria-label="Eliminar miembro">
            <Trash2Icon className="h-4 w-4" />
          </Button>

          <RemoveMemberDialog
            open={removeDialogOpen}
            onOpenChange={setRemoveDialogOpen}
            memberId={member.id}
            memberName={member.user.name}
          />
        </>
      )}
    </div>
  )
}
