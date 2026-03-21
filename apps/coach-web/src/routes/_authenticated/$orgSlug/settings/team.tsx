import { createFileRoute } from '@tanstack/react-router'
import { TeamSettingsView } from '@/features/settings/views/team-settings-view'

export const Route = createFileRoute('/_authenticated/$orgSlug/settings/team')({
  component: TeamSettingsView,
})
