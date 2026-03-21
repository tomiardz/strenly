import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$orgSlug/settings/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/$orgSlug/settings/general',
      params: { orgSlug: params.orgSlug },
    })
  },
})
