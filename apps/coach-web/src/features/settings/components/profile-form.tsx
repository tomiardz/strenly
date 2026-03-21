import { zodResolver } from '@hookform/resolvers/zod'
import { type UpdateProfileInput, updateProfileInputSchema } from '@strenly/contracts/auth/auth'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type ProfileFormProps = {
  onSubmit: (data: UpdateProfileInput, avatarFile?: File) => void
  defaultValues?: Partial<UpdateProfileInput & { email: string }>
  isSubmitting?: boolean
}

/**
 * Profile form component for editing user name and avatar.
 * Email is displayed read-only. Avatar file selection triggers an immediate preview.
 * The parent handles mutation logic — this component is pure UI.
 */
export function ProfileForm({ onSubmit, defaultValues, isSubmitting }: ProfileFormProps) {
  const { handleSubmit, control } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileInputSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      image: defaultValues?.image ?? undefined,
    },
  })

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = defaultValues?.name ?? ''
  const userInitials = displayName
    ? displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (defaultValues?.email?.[0]?.toUpperCase() ?? 'U')

  const currentAvatarSrc = avatarPreview ?? defaultValues?.image ?? undefined

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
  }

  const handleFormSubmit = (data: UpdateProfileInput) => {
    onSubmit(data, selectedFile ?? undefined)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-6">
      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        {/* Avatar section */}
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            {currentAvatarSrc ? <AvatarImage src={currentAvatarSrc} alt={displayName} /> : null}
            <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Cambiar avatar
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <p className="text-muted-foreground text-xs">JPG, PNG o GIF. Max 4MB.</p>
          </div>
        </div>

        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input id="name" placeholder="Tu nombre" {...field} />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Field>
          <FieldLabel htmlFor="email">Correo electronico</FieldLabel>
          <FieldContent>
            <Input
              id="email"
              type="email"
              value={defaultValues?.email ?? ''}
              readOnly
              disabled
              className="opacity-60"
            />
            <FieldDescription>El correo electronico no se puede cambiar desde aqui.</FieldDescription>
          </FieldContent>
        </Field>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
