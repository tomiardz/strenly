import type { Exercise } from '@strenly/contracts/exercises/exercise'
import type { ColumnDef, OnChangeFn, SortingState } from '@tanstack/react-table'
import { Archive, Copy, Pencil } from 'lucide-react'
import type React from 'react'
import { useMemo } from 'react'
import { MuscleBadges } from './muscle-badges'
import type { RowAction } from '@/components/data-table/data-table-row-actions'
import { createDataTableColumns } from '@/components/data-table/create-data-table-columns'
import { DataTable, type ErrorConfig } from '@/components/data-table/data-table'
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type UseExercisesColumnsOptions = {
  onEdit?: (exercise: Exercise) => void
  onArchive?: (exercise: Exercise) => void
  onClone?: (exercise: Exercise) => void
}

/**
 * Hook that creates exercises table column definitions using createDataTableColumns.
 * Returns memoized columns that include action dropdown with edit, clone, and archive actions.
 */
export function useExercisesColumns({
  onEdit,
  onArchive,
  onClone,
}: UseExercisesColumnsOptions): ColumnDef<Exercise, unknown>[] {
  return useMemo(
    () =>
      createDataTableColumns<Exercise>((helper) => [
        helper.accessor('name', {
          header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
          enableSorting: true,
          cell: ({ row }) => (
            <span className={cn('font-medium', row.original.archivedAt && 'text-muted-foreground line-through')}>
              {row.original.name}
            </span>
          ),
        }),
        helper.display({
          id: 'muscles',
          header: 'Musculos',
          cell: ({ row }) => (
            <div className={cn('flex flex-wrap gap-1', row.original.archivedAt && 'opacity-50')}>
              <MuscleBadges muscles={row.original.primaryMuscles} variant="primary" />
              <MuscleBadges muscles={row.original.secondaryMuscles} variant="secondary" />
            </div>
          ),
        }),
        helper.accessor('movementPattern', {
          header: 'Patron',
          cell: ({ row }) =>
            row.original.movementPattern ? (
              <span className={cn(row.original.archivedAt && 'text-muted-foreground')}>
                {capitalize(row.original.movementPattern)}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            ),
        }),
        helper.display({
          id: 'type',
          header: 'Tipo',
          cell: ({ row }) => (
            <Badge variant={row.original.isCurated ? 'default' : 'secondary'}>
              {row.original.isCurated ? 'Curado' : 'Personalizado'}
            </Badge>
          ),
        }),
        helper.actions({
          actions: (exercise) => {
            const actions: RowAction<Exercise>[] = []

            if (!exercise.isCurated && onEdit) {
              actions.push({ label: 'Editar', icon: Pencil, onClick: onEdit })
            }

            if (onClone) {
              actions.push({ label: 'Clonar', icon: Copy, onClick: onClone })
            }

            if (!exercise.isCurated && !exercise.archivedAt && onArchive) {
              actions.push({ label: 'Archivar', icon: Archive, onClick: onArchive, variant: 'destructive' })
            }

            return actions
          },
        }),
      ]),
    [onEdit, onArchive, onClone],
  )
}

type ExercisesTableProps = {
  data: Exercise[]
  totalCount: number
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number, pageSize: number) => void
  isLoading?: boolean
  error?: ErrorConfig | null
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  onEdit?: (exercise: Exercise) => void
  onArchive?: (exercise: Exercise) => void
  onClone?: (exercise: Exercise) => void
  children?: React.ReactNode
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Table component for displaying exercises with pagination and row actions
 */
export function ExercisesTable({
  data,
  totalCount,
  pageIndex,
  pageSize,
  onPageChange,
  isLoading,
  error,
  sorting,
  onSortingChange,
  onEdit,
  onArchive,
  onClone,
  children,
}: ExercisesTableProps) {
  const columns = useExercisesColumns({ onEdit, onArchive, onClone })

  return (
    <DataTable.Root
      columns={columns}
      data={data}
      totalCount={totalCount}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={onPageChange}
      isLoading={isLoading}
      error={error}
      sorting={sorting}
      onSortingChange={onSortingChange}
    >
      {children}
      <DataTable.Content
        emptyState={{
          title: 'No se encontraron ejercicios',
          description: 'Intenta ajustar los filtros de busqueda.',
        }}
      />
      <DataTable.Pagination />
    </DataTable.Root>
  )
}
