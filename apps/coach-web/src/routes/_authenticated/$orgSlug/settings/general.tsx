import { createFileRoute } from '@tanstack/react-router'
import { GeneralSettingsView } from '@/features/settings/views/general-settings-view'

export const Route = createFileRoute('/_authenticated/$orgSlug/settings/general')({
  component: GeneralSettingsView,
})
