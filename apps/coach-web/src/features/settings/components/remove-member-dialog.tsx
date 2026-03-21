import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRemoveMember } from '../hooks/use-remove-member'

type RemoveMemberDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
}

/**
 * Confirmation dialog for removing a member from the organization.
 * Shows member name and asks for confirmation in Spanish.
 * On confirm: calls removeMember mutation and closes dialog.
 */
export function RemoveMemberDialog({ open, onOpenChange, memberId, memberName }: RemoveMemberDialogProps) {
  const removeMember = useRemoveMember()

  const handleConfirm = () => {
    removeMember.mutate(memberId, {
      onSuccess: () => {
        onOpenChange(false)
      },
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar miembro</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estas seguro de que deseas eliminar a <strong>{memberName}</strong> de la organizacion? Esta accion no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleConfirm} disabled={removeMember.isPending}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
