import { createFileRoute } from '@tanstack/react-router'
import { ProfileView } from '@/features/settings/views/profile-view'

export const Route = createFileRoute('/_authenticated/$orgSlug/settings/profile')({
  component: ProfileView,
})
