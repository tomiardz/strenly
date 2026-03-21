import { z } from 'zod'

/**
 * Signup form validation schema
 */
export const signupInputSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  email: z.string().email('Por favor ingresa un correo electronico valido'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
})

export type SignupInput = z.infer<typeof signupInputSchema>

/**
 * Login form validation schema
 */
export const loginInputSchema = z.object({
  email: z.string().email('Por favor ingresa un correo electronico valido'),
  password: z.string().min(1, 'La contrasena es obligatoria'),
  rememberMe: z.boolean(),
})

export type LoginInput = z.infer<typeof loginInputSchema>

/**
 * Profile update form validation schema
 */
export const updateProfileInputSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar los 100 caracteres'),
  image: z.string().optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>
