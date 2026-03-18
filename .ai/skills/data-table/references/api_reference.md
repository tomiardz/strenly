# DataTable API Reference

Detailed prop types and interfaces for the DataTable component.

## DataTable.Root Props

```tsx
interface DataTableRootProps<TData> {
  // Required
  data: TData[]                           // Data array to display
  columns: ColumnDef<TData, unknown>[]    // TanStack column definitions
  children: React.ReactNode               // Compound components

  // Pagination (server-side, required)
  totalCount: number                      // Total items for pagination
  pageIndex: number                       // Current page (0-based)
  pageSize: number                        // Items per page
  onPageChange: (pageIndex: number, pageSize: number) => void

  // States
  isLoading?: boolean                     // Shows skeleton loading
  error?: ErrorConfig | null              // Shows error state

  // Sorting (server-side)
  sorting?: SortingState                  // Controlled sorting state
  onSortingChange?: OnChangeFn<SortingState>
}
```

## Compound Component Props

### DataTable.Header

```tsx
interface DataTableHeaderProps {
  title: string              // Main heading (required)
  description?: string       // Subheading text
  children?: React.ReactNode // Action buttons slot
}
```

### DataTable.Toolbar

```tsx
interface DataTableToolbarProps {
  children?: React.ReactNode // Search, filters, etc.
}
```

### DataTable.Search

```tsx
interface DataTableSearchProps {
  value: string                              // Controlled value (required)
  onValueChange: (value: string) => void     // Change callback (required)
  placeholder?: string                       // Default: 'Buscar...'
}
```

Debounce is hardcoded to 300ms. Includes a clear button when value is non-empty.

### DataTable.Content

```tsx
interface DataTableContentProps<TData> {
  onRowClick?: (row: TData) => void   // Row click handler
  emptyState?: EmptyStateConfig       // Custom empty state
}

interface EmptyStateConfig {
  title?: string           // Default: 'No hay datos'
  description?: string
  action?: React.ReactNode // Button or custom action
  icon?: React.ReactNode   // Custom icon
}
```

### DataTable.Pagination

Takes **zero props**. Reads all state from context (`totalCount`, `pageIndex`, `pageSize`, `onPageChange`).

Page size options: `[10, 25, 50, 100]` (hardcoded).

Displays: page size selector, previous/next buttons, page number buttons with ellipsis, item count.

### DataTable.ColumnHeader

```tsx
interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>  // TanStack column
  title: string                  // Display text
  className?: string
}
```

## Column Helper Methods

### helper.accessor()

Standard TanStack accessor with all regular options.

### helper.display()

Standard TanStack display column for computed/custom cells.

### helper.actions()

```tsx
helper.actions({
  id?: string,  // Default: 'actions'
  actions: (row: TData) => RowAction<TData>[]
})

interface RowAction<TData> {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick: (row: TData) => void
  variant?: 'default' | 'destructive'
}
```

Creates a dropdown menu with `MoreHorizontal` icon. Destructive actions are separated by a divider.

## Error Config

```tsx
interface ErrorConfig {
  message: string
  retry?: () => void  // Optional retry button
}
```

## Complete Example

```tsx
import { useState } from 'react'
import { DataTable, createDataTableColumns } from '@/components/data-table'
import type { SortingState } from '@tanstack/react-table'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface User {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
}

function UsersTable() {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])

  const { data, isLoading, error, refetch } = useUsersQuery({
    limit: pageSize,
    offset: pageIndex * pageSize,
    search,
    sortField: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
  })

  const handlePageChange = (newPageIndex: number, newPageSize: number) => {
    setPageIndex(newPageIndex)
    setPageSize(newPageSize)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPageIndex(0)
  }

  const columns = createDataTableColumns<User>((helper) => [
    helper.accessor('name', {
      header: ({ column }) => (
        <DataTable.ColumnHeader column={column} title="Nombre" />
      ),
      enableSorting: true,
    }),
    helper.accessor('email', { header: 'Email' }),
    helper.accessor('status', {
      header: 'Estado',
      cell: ({ getValue }) => (
        <Badge variant={getValue() === 'active' ? 'default' : 'secondary'}>
          {getValue() === 'active' ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    }),
    helper.actions({
      actions: (row) => [
        { label: 'Editar', icon: PencilIcon, onClick: () => handleEdit(row) },
        { label: 'Eliminar', icon: TrashIcon, onClick: () => handleDelete(row), variant: 'destructive' },
      ],
    }),
  ])

  return (
    <DataTable.Root
      data={data?.items ?? []}
      columns={columns}
      totalCount={data?.totalCount ?? 0}
      pageIndex={pageIndex}
      pageSize={pageSize}
      onPageChange={handlePageChange}
      isLoading={isLoading}
      error={error ? { message: 'Error al cargar usuarios', retry: refetch } : null}
      sorting={sorting}
      onSortingChange={setSorting}
    >
      <DataTable.Header title="Usuarios" description="Gestiona los usuarios del sistema">
        <Button>Agregar Usuario</Button>
      </DataTable.Header>

      <DataTable.Toolbar>
        <DataTable.Search
          placeholder="Buscar por nombre o email..."
          value={search}
          onValueChange={handleSearchChange}
        />
      </DataTable.Toolbar>

      <DataTable.Content
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        emptyState={{
          title: 'No hay usuarios',
          description: 'Agrega tu primer usuario para comenzar',
          action: <Button>Crear Usuario</Button>,
        }}
      />

      <DataTable.Pagination />
    </DataTable.Root>
  )
}
```
