import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Member = {
  id: string
  userId: string
  role: string
  createdAt: Date | string
  user: {
    name: string
    email: string
    image?: string | null
  }
}

type MemberListProps = {
  members: Member[]
  isLoading: boolean
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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function formatDate(dateString: Date | string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Member list component for the Team settings page.
 * Displays org members in a table with avatar, name, email, role badge, and join date.
 * Includes skeleton loading and empty states.
 */
export function MemberList({ members, isLoading }: MemberListProps) {
  if (isLoading) {
    return <MemberListSkeleton />
  }

  if (members.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <p className="font-medium text-sm">No hay otros miembros en tu organizacion</p>
        <p className="mt-1 text-muted-foreground text-sm">Invita a miembros de tu equipo para colaborar juntos.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Ingreso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  {member.user.image ? <AvatarImage src={member.user.image} alt={member.user.name} /> : null}
                  <AvatarFallback>{getInitials(member.user.name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{member.user.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{member.user.email}</TableCell>
            <TableCell>
              <Badge variant={roleBadgeVariant[member.role] ?? 'outline'}>
                {roleLabel[member.role] ?? member.role}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MemberListSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Ingreso</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable id
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Skeleton className="size-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-40" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-4xl" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
