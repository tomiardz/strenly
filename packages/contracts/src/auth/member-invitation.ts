import { z } from 'zod'
import { emailSchema } from '../common/email'

/**
 * Invitable roles for the role selector.
 * Owners can also select 'owner' — handled in UI, not schema.
 */
export const invitableRoleSchema = z.enum(['coach', 'manager'], {
  error: 'Rol invitable invalido',
})
export type InvitableRole = z.infer<typeof invitableRoleSchema>

/**
 * Input schema for inviting a member to the organization.
 */
export const inviteMemberInputSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema,
})
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>
