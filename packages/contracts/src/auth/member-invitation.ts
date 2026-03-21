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
 * Invitable roles including 'owner', for use when the current user is an owner.
 */
export const invitableRoleWithOwnerSchema = z.enum(['coach', 'manager', 'owner'], {
  error: 'Rol invitable invalido',
})
export type InvitableRoleWithOwner = z.infer<typeof invitableRoleWithOwnerSchema>

/**
 * Input schema for inviting a member to the organization.
 */
export const inviteMemberInputSchema = z.object({
  email: emailSchema,
  role: invitableRoleSchema,
})
export type InviteMemberInput = z.infer<typeof inviteMemberInputSchema>

/**
 * Input schema for inviting a member when the current user is an owner.
 * Includes the 'owner' role option.
 */
export const inviteMemberOwnerInputSchema = z.object({
  email: emailSchema,
  role: invitableRoleWithOwnerSchema,
})
export type InviteMemberOwnerInput = z.infer<typeof inviteMemberOwnerInputSchema>
