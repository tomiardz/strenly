import { createFileRoute } from '@tanstack/react-router'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_authenticated/$orgSlug/help')({
  component: HelpPage,
})

function HelpPage() {
  return (
    <ComingSoon
      title="Centro de Ayuda"
      description="El centro de ayuda estara disponible proximamente."
    />
  )
}
