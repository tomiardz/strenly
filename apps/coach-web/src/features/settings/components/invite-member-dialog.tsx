import { zodResolver } from '@hookform/resolvers/zod'
import { type InviteMemberOwnerInput, inviteMemberOwnerInputSchema } from '@strenly/contracts/auth/member-invitation'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useInviteMember } from '../hooks/use-invite-member'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/lib/toast'

type InviteMemberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Whether the current user is an owner (can invite owners) */
  isOwner: boolean
}

const ROLE_OPTIONS = [
  { value: 'coach', label: 'Coach' },
  { value: 'manager', label: 'Manager' },
]

const OWNER_ROLE_OPTION = { value: 'owner', label: 'Propietario' }

function truncateUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url
  const start = url.slice(0, 25)
  const end = url.slice(-20)
  return `${start}...${end}`
}

/**
 * Dialog for inviting a new member to the organization.
 * Shows a form with email and role fields.
 * On success, displays the invitation link with copy-to-clipboard.
 */
export function InviteMemberDialog({ open, onOpenChange, isOwner }: InviteMemberDialogProps) {
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inviteMutation = useInviteMember()

  const roleOptions = isOwner ? [...ROLE_OPTIONS, OWNER_ROLE_OPTION] : ROLE_OPTIONS

  const { handleSubmit, control, reset } = useForm<InviteMemberOwnerInput>({
    resolver: zodResolver(inviteMemberOwnerInputSchema),
    defaultValues: {
      email: '',
      role: 'coach',
    },
  })

  const handleClose = (value: boolean) => {
    if (!value) {
      reset()
      setInvitationUrl(null)
      setCopied(false)
      inviteMutation.reset()
    }
    onOpenChange(value)
  }

  const onSubmit = (data: InviteMemberOwnerInput) => {
    inviteMutation.mutate(data, {
      onSuccess: (result) => {
        const url = `${window.location.origin}/invitation/accept?id=${result.id}`
        setInvitationUrl(url)
        toast.success('Invitacion enviada exitosamente')
      },
    })
  }

  const handleCopy = async () => {
    if (!invitationUrl) return
    try {
      await navigator.clipboard.writeText(invitationUrl)
      setCopied(true)
      toast.success('Link copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
        </DialogHeader>

        {invitationUrl ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Comparte este link con el miembro para que se una a tu organizacion.
            </p>
            <div className="space-y-2">
              <span className="text-muted-foreground text-sm">Link de invitacion:</span>
              <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                <code className="flex-1 text-xs">{truncateUrl(invitationUrl)}</code>
                <Button size="sm" variant="ghost" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <fieldset disabled={inviteMutation.isPending} className="flex flex-col gap-6">
              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="invite-email">
                      Correo electronico <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input id="invite-email" type="email" placeholder="coach@ejemplo.com" {...field} />
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="role"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="invite-role">
                      Rol <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="invite-role">
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError errors={[fieldState.error]} />
                    </FieldContent>
                  </Field>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Enviando...' : 'Enviar invitacion'}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
