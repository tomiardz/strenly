import { createFileRoute } from '@tanstack/react-router'
import { ComingSoon } from '@/components/coming-soon'

export const Route = createFileRoute('/_authenticated/$orgSlug/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  return <ComingSoon title="Plantillas" description="La gestion de plantillas estara disponible proximamente." />
}
