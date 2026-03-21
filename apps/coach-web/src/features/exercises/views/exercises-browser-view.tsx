import type { CreateExerciseInput, Exercise } from '@strenly/contracts/exercises/exercise'
import type { MovementPattern, MuscleGroup } from '@strenly/contracts/exercises/muscle-group'
import type { SortingState } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { ExerciseFilters } from '../components/exercise-filters'
import { ExerciseForm } from '../components/exercise-form'
import { ExercisesTable } from '../components/exercises-table'
import { useArchiveExercise } from '../hooks/mutations/use-archive-exercise'
import { useCloneExercise } from '../hooks/mutations/use-clone-exercise'
import { useCreateExercise } from '../hooks/mutations/use-create-exercise'
import { useUpdateExercise } from '../hooks/mutations/use-update-exercise'
import { useExercises } from '../hooks/queries/use-exercises'
import { DataTable } from '@/components/data-table/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { toast } from '@/lib/toast'

/**
 * Exercises browser view with search, filters, pagination, and CRUD operations.
 * Allows coaches to manage their exercise library - create, edit, archive, and clone.
 */
export function ExercisesBrowserView() {
  const [search, setSearch] = useState('')
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | undefined>()
  const [movementPattern, setMovementPattern] = useState<MovementPattern | undefined>()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<SortingState>([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [archiveDialogExercise, setArchiveDialogExercise] = useState<Exercise | null>(null)

  const { data, isLoading, error, refetch } = useExercises({
    search: search || undefined,
    muscleGroup,
    movementPattern,
    includeArchived: includeArchived || undefined,
    limit: pageSize,
    offset: pageIndex * pageSize,
  })

  // Mutations
  const createMutation = useCreateExercise()
  const updateMutation = useUpdateExercise()
  const archiveMutation = useArchiveExercise()
  const cloneMutation = useCloneExercise()

  const handlePageChange = (newPageIndex: number, newPageSize: number) => {
    setPageIndex(newPageIndex)
    setPageSize(newPageSize)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPageIndex(0)
  }

  const handleMuscleGroupChange = (value: MuscleGroup | undefined) => {
    setMuscleGroup(value)
    setPageIndex(0)
  }

  const handleMovementPatternChange = (value: MovementPattern | undefined) => {
    setMovementPattern(value)
    setPageIndex(0)
  }

  const handleIncludeArchivedChange = (checked: boolean | 'indeterminate') => {
    setIncludeArchived(checked === true)
    setPageIndex(0)
  }

  const handleAddExercise = () => {
    setEditingExercise(null)
    setDialogOpen(true)
  }

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setDialogOpen(true)
  }

  const handleArchive = (exercise: Exercise) => {
    setArchiveDialogExercise(exercise)
  }

  const handleConfirmArchive = () => {
    if (!archiveDialogExercise) return
    archiveMutation.mutate(
      { exerciseId: archiveDialogExercise.id },
      {
        onSuccess: () => {
          toast.success('Ejercicio archivado exitosamente')
          setArchiveDialogExercise(null)
        },
      },
    )
  }

  const handleClone = (exercise: Exercise) => {
    cloneMutation.mutate(
      { sourceExerciseId: exercise.id, name: `${exercise.name} (copia)` },
      {
        onSuccess: () => {
          toast.success('Ejercicio clonado exitosamente')
        },
      },
    )
  }

  const handleFormSubmit = (formData: CreateExerciseInput) => {
    if (editingExercise) {
      updateMutation.mutate(
        {
          exerciseId: editingExercise.id,
          ...formData,
        },
        {
          onSuccess: () => {
            toast.success('Ejercicio actualizado exitosamente')
            setDialogOpen(false)
            setEditingExercise(null)
          },
        },
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          toast.success('Ejercicio creado exitosamente')
          setDialogOpen(false)
        },
      })
    }
  }

  const handleFormCancel = () => {
    setDialogOpen(false)
    setEditingExercise(null)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Ejercicios</h1>
          <p className="text-muted-foreground text-sm">Explora y gestiona tu biblioteca de ejercicios</p>
        </div>
        <Button onClick={handleAddExercise}>
          <Plus className="h-4 w-4" />
          Crear ejercicio
        </Button>
      </div>

      <ExercisesTable
        data={data?.items ?? []}
        totalCount={data?.totalCount ?? 0}
        pageIndex={pageIndex}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        isLoading={isLoading}
        error={error ? { message: 'Error al cargar ejercicios', retry: refetch } : null}
        sorting={sorting}
        onSortingChange={setSorting}
        onEdit={handleEdit}
        onArchive={handleArchive}
        onClone={handleClone}
      >
        <DataTable.Toolbar>
          <div className="flex flex-1 items-center gap-4">
            <DataTable.Search value={search} onValueChange={handleSearchChange} placeholder="Buscar ejercicios..." />
            <ExerciseFilters
              muscleGroup={muscleGroup}
              movementPattern={movementPattern}
              onMuscleGroupChange={handleMuscleGroupChange}
              onMovementPatternChange={handleMovementPatternChange}
            />
            <Field orientation="horizontal" className="gap-2">
              <Checkbox id="include-archived" checked={includeArchived} onCheckedChange={handleIncludeArchivedChange} />
              <FieldLabel htmlFor="include-archived" className="font-normal text-sm">
                Mostrar archivados
              </FieldLabel>
            </Field>
          </div>
        </DataTable.Toolbar>
      </ExercisesTable>

      {/* Create/Edit Exercise Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExercise ? 'Editar ejercicio' : 'Crear nuevo ejercicio'}</DialogTitle>
            <DialogDescription>
              {editingExercise
                ? 'Actualiza la información del ejercicio.'
                : 'Crea un nuevo ejercicio personalizado para tu biblioteca.'}
            </DialogDescription>
          </DialogHeader>
          <ExerciseForm
            id="exercise-form"
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            defaultValues={
              editingExercise
                ? {
                    name: editingExercise.name,
                    description: editingExercise.description ?? undefined,
                    instructions: editingExercise.instructions ?? undefined,
                    videoUrl: editingExercise.videoUrl ?? undefined,
                    movementPattern: editingExercise.movementPattern ?? undefined,
                    primaryMuscles: editingExercise.primaryMuscles ?? undefined,
                    secondaryMuscles: editingExercise.secondaryMuscles ?? undefined,
                    isUnilateral: editingExercise.isUnilateral ?? undefined,
                  }
                : undefined
            }
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleFormCancel} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" form="exercise-form" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : editingExercise ? 'Actualizar ejercicio' : 'Crear ejercicio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={!!archiveDialogExercise} onOpenChange={(open) => !open && setArchiveDialogExercise(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar ejercicio</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres archivar "{archiveDialogExercise?.name}"? El ejercicio no se eliminará, pero
              dejará de aparecer en las búsquedas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmArchive}
              disabled={archiveMutation.isPending}
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
