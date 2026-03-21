import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$orgSlug/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$orgSlug/settings/profile',
      params: { orgSlug: params.orgSlug },
    })
  },
})
