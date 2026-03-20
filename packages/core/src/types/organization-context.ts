import type { OrganizationRole } from '../services/authorization'

export type OrganizationContext = {
  organizationId: string
  userId: string
  roles: OrganizationRole[]
}
