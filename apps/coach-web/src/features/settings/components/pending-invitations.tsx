import { X } from 'lucide-react'
import { useCancelInvitation } from '../hooks/use-cancel-invitation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Invitation = {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date | string
}

type PendingInvitationsProps = {
  invitations: Invitation[]
  isLoading: boolean
  canInviteMembers: boolean
}

const roleBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'ghost'> = {
  owner: 'default',
  manager: 'secondary',
  coach: 'outline',
  athlete: 'ghost',
}

const roleLabel: Record<string, string> = {
  owner: 'Propietario',
  manager: 'Manager',
  coach: 'Coach',
  athlete: 'Atleta',
  member: 'Miembro',
}

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  canceled: 'Cancelada',
  rejected: 'Rechazada',
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  accepted: 'default',
  canceled: 'destructive',
  rejected: 'destructive',
}

function formatDate(dateString: Date | string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Pending invitations section for the Team settings page.
 * Shows pending invitations with email, role, status, expiration, and cancel action.
 * Does not render at all when there are no pending invitations and not loading.
 */
export function PendingInvitations({ invitations, isLoading, canInviteMembers }: PendingInvitationsProps) {
  const pendingInvitations = invitations.filter((inv) => inv.status === 'pending')

  if (isLoading) {
    return <PendingInvitationsSkeleton />
  }

  if (pendingInvitations.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h2 className="font-medium text-lg">Invitaciones pendientes</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Expira</TableHead>
            {canInviteMembers && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingInvitations.map((invitation) => (
            <PendingInvitationRow key={invitation.id} invitation={invitation} canCancel={canInviteMembers} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PendingInvitationRow({ invitation, canCancel }: { invitation: Invitation; canCancel: boolean }) {
  const cancelMutation = useCancelInvitation()

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant={roleBadgeVariant[invitation.role] ?? 'outline'}>
          {roleLabel[invitation.role] ?? invitation.role}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={statusBadgeVariant[invitation.status] ?? 'outline'}>
          {statusLabel[invitation.status] ?? invitation.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(invitation.expiresAt)}</TableCell>
      {canCancel && (
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => cancelMutation.mutate(invitation.id)}
            disabled={cancelMutation.isPending}
            aria-label="Cancelar invitacion"
          >
            <X className="h-4 w-4" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}

function PendingInvitationsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-48" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Expira</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 2 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable id
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-40" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
