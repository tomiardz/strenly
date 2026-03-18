import type { LoginInput } from '@strenly/contracts/auth/auth'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { AuthLayout } from '../components/auth-layout'
import { LoginForm } from '../components/login-form'
import { OAuthButtons } from '../components/oauth-buttons'
import { authClient } from '@/lib/auth-client'

export function LoginView() {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (data: LoginInput) => {
    setIsLoading(true)
    try {
      const result = await authClient.signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      })

      if (result.error) {
        toast.error(result.error.message ?? 'Error al iniciar sesion')
        setIsLoading(false)
        return
      }

      const orgs = await authClient.organization.list()
      if (orgs.data?.length) {
        const firstOrg = orgs.data[0]
        if (firstOrg?.slug) {
          navigate({ to: '/$orgSlug/dashboard', params: { orgSlug: firstOrg.slug } })
        } else {
          navigate({ to: '/onboarding' })
        }
      } else {
        navigate({ to: '/onboarding' })
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesion')
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-bold text-2xl text-foreground">Inicia sesión</h2>
          <p className="text-muted-foreground text-sm">Bienvenido de vuelta. Ingresa tus credenciales.</p>
        </div>

        <OAuthButtons />

        <LoginForm onSubmit={handleLogin} isSubmitting={isLoading} />

        <p className="text-center text-muted-foreground text-sm">
          ¿No tienes cuenta?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
