import { Link } from '@tanstack/react-router'
import { ConstructionIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrgSlug } from '@/hooks/use-org-slug'

interface ComingSoonProps {
  title?: string
  description?: string
}

export function ComingSoon({
  title = 'Proximamente',
  description = 'Esta funcionalidad esta en desarrollo.',
}: ComingSoonProps) {
  const orgSlug = useOrgSlug()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <ConstructionIcon className="h-12 w-12 text-muted-foreground" />
      <h1 className="font-bold text-2xl">{title}</h1>
      <p className="max-w-md text-center text-muted-foreground">{description}</p>
      <Button render={<Link to="/$orgSlug/dashboard" params={{ orgSlug }} />}>Volver al panel</Button>
    </div>
  )
}
