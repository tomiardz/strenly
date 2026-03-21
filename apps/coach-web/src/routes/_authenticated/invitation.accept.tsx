import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { clearAuthCache } from '@/lib/auth-cache'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

const invitationSearchSchema = z.object({
  id: z.string(),
})

export const Route = createFileRoute('/_authenticated/invitation/accept')({
  validateSearch: invitationSearchSchema,
  component: InvitationAcceptPage,
  pendingComponent: InvitationPending,
})

const roleLabel: Record<string, string> = {
  owner: 'Propietario',
  manager: 'Manager',
  coach: 'Coach',
  athlete: 'Atleta',
}

type InvitationState =
  | { status: 'loading' }
  | { status: 'loaded'; invitation: InvitationData }
  | { status: 'accepted'; orgSlug: string }
  | { status: 'already-accepted'; orgSlug?: string }
  | { status: 'error'; message: string }

type InvitationData = {
  id: string
  email: string
  role: string
  status: string
  organizationName: string
  organizationSlug: string
  inviterEmail: string
  expiresAt: Date
}

function InvitationPending() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function InvitationAcceptPage() {
  const { id: invitationId } = Route.useSearch()
  const navigate = useNavigate()
  const [state, setState] = useState<InvitationState>({ status: 'loading' })
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)

  const fetchInvitation = useCallback(async () => {
    const result = await authClient.organization.getInvitation({
      query: { id: invitationId },
    })

    if (result.error) {
      setState({
        status: 'error',
        message: 'No se pudo cargar la invitacion. Es posible que haya expirado o no exista.',
      })
      return
    }

    const invitation = result.data
    if (!invitation) {
      setState({ status: 'error', message: 'Invitacion no encontrada.' })
      return
    }

    if (invitation.status === 'accepted') {
      setState({ status: 'already-accepted', orgSlug: invitation.organizationSlug })
      return
    }

    if (invitation.status === 'canceled' || invitation.status === 'rejected') {
      setState({ status: 'error', message: 'Esta invitacion ya no es valida.' })
      return
    }

    const expiresAt = new Date(invitation.expiresAt)
    if (expiresAt < new Date()) {
      setState({ status: 'error', message: 'Esta invitacion ha expirado.' })
      return
    }

    setState({
      status: 'loaded',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        organizationName: invitation.organizationName ?? '',
        organizationSlug: invitation.organizationSlug ?? '',
        inviterEmail: invitation.inviterEmail ?? '',
        expiresAt,
      },
    })
  }, [invitationId])

  // Fetch invitation on mount using a ref to avoid useEffect
  const [hasFetched, setHasFetched] = useState(false)
  if (!hasFetched) {
    setHasFetched(true)
    fetchInvitation()
  }

  const handleAccept = async () => {
    setIsAccepting(true)
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      })

      if (result.error) {
        const errorMessage = result.error.message ?? 'Error al aceptar la invitacion'
        // Check for already-accepted scenario
        if (errorMessage.toLowerCase().includes('already')) {
          setState({ status: 'already-accepted' })
        } else {
          toast.error(errorMessage)
        }
        return
      }

      // Clear auth cache so organization list refreshes
      clearAuthCache()

      if (state.status === 'loaded') {
        const orgSlug = state.invitation.organizationSlug
        setState({ status: 'accepted', orgSlug })
        toast.success('Invitacion aceptada exitosamente')

        // Navigate to the organization dashboard
        navigate({
          to: '/$orgSlug/dashboard',
          params: { orgSlug },
        })
      }
    } catch {
      toast.error('Error al aceptar la invitacion')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleDecline = async () => {
    setIsDeclining(true)
    try {
      const result = await authClient.organization.rejectInvitation({
        invitationId,
      })

      if (result.error) {
        toast.error(result.error.message ?? 'Error al rechazar la invitacion')
        return
      }

      toast.info('Invitacion rechazada')
      navigate({ to: '/' })
    } catch {
      toast.error('Error al rechazar la invitacion')
    } finally {
      setIsDeclining(false)
    }
  }

  if (state.status === 'loading') {
    return <InvitationPending />
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <CardTitle>Invitacion no valida</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="outline" render={<Link to="/" />}>
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (state.status === 'already-accepted') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <CardTitle>Invitacion ya aceptada</CardTitle>
            <CardDescription>Esta invitacion ya fue aceptada anteriormente.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            {state.orgSlug ? (
              <Button render={<Link to="/$orgSlug/dashboard" params={{ orgSlug: state.orgSlug }} />}>
                Ir a la organizacion
              </Button>
            ) : (
              <Button variant="outline" render={<Link to="/" />}>
                Volver al inicio
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (state.status === 'accepted') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <CardTitle>Bienvenido al equipo</CardTitle>
            <CardDescription>Te has unido exitosamente a la organizacion.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button render={<Link to="/$orgSlug/dashboard" params={{ orgSlug: state.orgSlug }} />}>
              Ir al dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // status === 'loaded'
  const { invitation } = state

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <CardTitle>Invitacion a {invitation.organizationName}</CardTitle>
          <CardDescription>
            Has sido invitado por {invitation.inviterEmail} a unirte como{' '}
            <Badge variant="secondary">{roleLabel[invitation.role] ?? invitation.role}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Organizacion</span>
              <span className="font-medium">{invitation.organizationName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium">{roleLabel[invitation.role] ?? invitation.role}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invitado por</span>
              <span className="font-medium">{invitation.inviterEmail}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleDecline} disabled={isAccepting || isDeclining}>
            {isDeclining ? 'Rechazando...' : 'Rechazar'}
          </Button>
          <Button onClick={handleAccept} disabled={isAccepting || isDeclining}>
            {isAccepting ? 'Aceptando...' : 'Aceptar invitacion'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
