import { zodResolver } from '@hookform/resolvers/zod'
import { type CreateExerciseInput, createExerciseInputSchema } from '@strenly/contracts/exercises/exercise'
import type { MuscleGroup } from '@strenly/contracts/exercises/muscle-group'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useMuscleGroups } from '../hooks/queries/use-muscle-groups'

const MOVEMENT_PATTERN_OPTIONS = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'squat', label: 'Squat' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'carry', label: 'Carry' },
  { value: 'core', label: 'Core' },
]

type ExerciseFormProps = {
  id?: string
  onSubmit: (data: CreateExerciseInput) => void
  defaultValues?: Partial<CreateExerciseInput>
  /** Whether the form is currently submitting (disables all fields) */
  isSubmitting?: boolean
}

/**
 * Form component for creating or editing an exercise.
 * Uses React Hook Form with Zod validation.
 * Accepts an optional id prop to link with external submit buttons.
 */
export function ExerciseForm({ id, onSubmit, defaultValues, isSubmitting }: ExerciseFormProps) {
  const { handleSubmit, control } = useForm<CreateExerciseInput>({
    resolver: zodResolver(createExerciseInputSchema),
    defaultValues,
  })

  const { data: muscleGroups } = useMuscleGroups()

  const muscleGroupOptions = useMemo(
    () => muscleGroups?.map((mg) => ({ value: mg.name, label: mg.displayName })) ?? [],
    [muscleGroups],
  )

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <fieldset disabled={isSubmitting} className="flex flex-col gap-6">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input id="name" placeholder="Ingresa el nombre del ejercicio" {...field} />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="description"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
              <FieldContent>
                <Textarea
                  id="description"
                  placeholder="Descripción breve del ejercicio..."
                  rows={3}
                  {...field}
                  value={field.value ?? ''}
                />
                <FieldDescription>Máximo 500 caracteres</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="instructions"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="instructions">Instrucciones</FieldLabel>
              <FieldContent>
                <Textarea
                  id="instructions"
                  placeholder="Instrucciones detalladas para realizar el ejercicio..."
                  rows={4}
                  {...field}
                  value={field.value ?? ''}
                />
                <FieldDescription>Máximo 2000 caracteres</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="videoUrl"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="videoUrl">URL de video</FieldLabel>
              <FieldContent>
                <Input
                  id="videoUrl"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  {...field}
                  value={field.value ?? ''}
                />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="movementPattern"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="movementPattern">Patrón de movimiento</FieldLabel>
              <FieldContent>
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="movementPattern">
                    <SelectValue placeholder="Seleccionar patrón" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOVEMENT_PATTERN_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="primaryMuscles"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Músculos primarios</FieldLabel>
              <FieldContent>
                <MuscleGroupSelector
                  options={muscleGroupOptions}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="secondaryMuscles"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Músculos secundarios</FieldLabel>
              <FieldContent>
                <MuscleGroupSelector
                  options={muscleGroupOptions}
                  value={field.value ?? []}
                  onChange={field.onChange}
                />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="isUnilateral"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} orientation="horizontal" className="gap-2">
              <Checkbox
                id="isUnilateral"
                checked={field.value ?? false}
                onCheckedChange={field.onChange}
              />
              <FieldLabel htmlFor="isUnilateral">Ejercicio unilateral</FieldLabel>
            </Field>
          )}
        />
      </fieldset>
    </form>
  )
}

/**
 * Simple checkbox group for selecting multiple muscle groups.
 * Renders each muscle group as a toggleable badge.
 */
function MuscleGroupSelector({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: MuscleGroup; label: string }>
  value: MuscleGroup[]
  onChange: (value: MuscleGroup[]) => void
}) {
  const handleToggle = (muscleGroup: MuscleGroup) => {
    const current = value ?? []
    const isSelected = current.includes(muscleGroup)
    if (isSelected) {
      onChange(current.filter((mg) => mg !== muscleGroup))
    } else {
      onChange([...current, muscleGroup])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = value?.includes(option.value) ?? false
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
          >
            <Badge variant={isSelected ? 'default' : 'outline'}>{option.label}</Badge>
          </button>
        )
      })}
    </div>
  )
}
