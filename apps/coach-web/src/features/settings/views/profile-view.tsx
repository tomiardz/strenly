import type { UpdateProfileInput } from '@strenly/contracts/auth/auth'
import { useState } from 'react'
import { ProfileForm } from '../components/profile-form'
import { useAuth } from '@/contexts/auth-context'
import { clearAuthCache } from '@/lib/auth-cache'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Profile settings view.
 * Reads current user data from auth context and handles profile updates
 * via Better-Auth's updateUser endpoint.
 */
export function ProfileView() {
  const { user } = useAuth()
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (data: UpdateProfileInput, avatarFile?: File) => {
    setIsPending(true)
    try {
      let imageValue = data.image

      // Convert uploaded file to base64 data URL
      if (avatarFile) {
        imageValue = await fileToBase64(avatarFile)
      }

      const result = await authClient.updateUser({
        name: data.name,
        image: imageValue,
      })

      if (result.error) {
        toast.error('Error al actualizar el perfil. Intenta de nuevo.')
        setIsPending(false)
        return
      }

      clearAuthCache()
      toast.success('Perfil actualizado correctamente')
      setIsPending(false)
    } catch {
      toast.error('Error al actualizar el perfil. Intenta de nuevo.')
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm">Actualiza tu informacion personal y avatar.</p>
      </div>

      <div className="max-w-lg">
        <ProfileForm
          onSubmit={handleSubmit}
          defaultValues={{
            name: user.name,
            email: user.email,
            image: user.image ?? undefined,
          }}
          isSubmitting={isPending}
        />
      </div>
    </div>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to read file'))
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
