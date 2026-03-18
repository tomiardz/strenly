import type { SignupInput } from '@strenly/contracts/auth/auth'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth-layout'
import { OAuthButtons } from '../components/oauth-buttons'
import { SignupForm } from '../components/signup-form'
import { authClient } from '@/lib/auth-client'

export function SignupView() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSignup = async (data: SignupInput) => {
    setIsLoading(true)
    try {
      const result = await authClient.signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      })

      if (result.error) {
        toast.error(result.error.message ?? 'Error al crear cuenta')
        setIsLoading(false)
        return
      }

      // New users always need to create an organization
      navigate({ to: '/onboarding' })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al crear cuenta')
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-bold text-2xl text-foreground">Crea tu cuenta</h2>
          <p className="text-muted-foreground text-sm">Comienza con Strenly hoy.</p>
        </div>

        <OAuthButtons />

        <SignupForm onSubmit={handleSignup} isSubmitting={isLoading} />

        <p className="text-center text-muted-foreground text-sm">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
