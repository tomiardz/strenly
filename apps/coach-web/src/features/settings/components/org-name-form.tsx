import { zodResolver } from '@hookform/resolvers/zod'
import { organizationSchema } from '@strenly/contracts/auth/organization'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const orgNameFormSchema = organizationSchema.pick({ name: true })

type OrgNameFormValues = { name: string }

type OrgNameFormProps = {
  onSubmit: (data: OrgNameFormValues) => void
  defaultValues: { name: string; slug: string }
  isSubmitting?: boolean
  disabled?: boolean
}

/**
 * Organization name form component.
 * Follows profile-form.tsx pattern: useForm + zodResolver + Controller + Field.
 * Name is editable (unless disabled), slug is always read-only.
 * The `disabled` prop disables the entire form for non-managers.
 */
export function OrgNameForm({ onSubmit, defaultValues, isSubmitting, disabled }: OrgNameFormProps) {
  const { handleSubmit, control } = useForm<OrgNameFormValues>({
    resolver: zodResolver(orgNameFormSchema),
    defaultValues: {
      name: defaultValues.name,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <fieldset disabled={isSubmitting ?? disabled} className="flex flex-col gap-6">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="org-name">
                Nombre <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input id="org-name" placeholder="Nombre de la organizacion" {...field} />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Field>
          <FieldLabel htmlFor="org-slug">URL</FieldLabel>
          <FieldContent>
            <Input
              id="org-slug"
              value={defaultValues.slug}
              readOnly
              disabled
              className="opacity-60"
            />
            <FieldDescription>La URL de la organizacion no se puede cambiar.</FieldDescription>
          </FieldContent>
        </Field>
      </fieldset>

      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </form>
  )
}
