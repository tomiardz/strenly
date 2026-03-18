---
name: data-table
description: |
  Guide for building tables with the DataTable compound component. Use when creating new tables,
  migrating existing tables to the DataTable pattern, or needing reference for DataTable APIs
  (columns, pagination, filtering, row actions). Covers imports, compound structure, column helpers,
  state handling, and server-side pagination.
  Do NOT load for simple lists, card grids, or non-tabular data displays.
---

<objective>
Builds tables using the DataTable compound component with TanStack Table, supporting server-side pagination, sorting, filtering, and row actions. Provides patterns for column definitions, state handling, and backend integration.
</objective>

<quick_start>
```tsx
import {
  DataTable,
  DataTableColumnHeader,
  createDataTableColumns,
  type SortingState,
} from '@/components/ui/data-table'

const columns = createDataTableColumns<MyType>((helper) => [
  helper.accessor('name', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    enableSorting: true,
  }),
  helper.actions({
    actions: (row) => [
      { label: 'Editar', icon: PencilIcon, onClick: () => onEdit(row) },
    ],
  }),
])

<DataTable.Root
  data={items}
  columns={columns}
  totalCount={totalCount}
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={handlePageChange}
  isLoading={isLoading}
>
  <DataTable.Header title="Título" />
  <DataTable.Content />
  <DataTable.Pagination />
</DataTable.Root>
```
</quick_start>

<basic_structure>
```tsx
<DataTable.Root
  data={items}
  columns={columns}
  totalCount={totalCount}
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={handlePageChange}
  isLoading={isLoading}
  error={error ? { message: error.message, retry: refetch } : null}
>
  <DataTable.Header title="Título" description="Descripción opcional">
    <Button>Acción</Button>
  </DataTable.Header>

  <DataTable.Toolbar>
    <DataTable.Search placeholder="Buscar..." value={search} onValueChange={setSearch} />
    {/* Custom filters — use raw <Select> or other components */}
  </DataTable.Toolbar>

  <DataTable.Content
    onRowClick={(row) => navigate(`/items/${row.id}`)}
    emptyState={{
      title: "No hay datos",
      description: "Descripción del estado vacío",
      action: <Button>Crear</Button>
    }}
  />

  <DataTable.Pagination />
</DataTable.Root>
```
</basic_structure>

<column_definitions>
Use `createDataTableColumns` for type-safe column definitions:

```tsx
const columns = createDataTableColumns<MyType>((helper) => [
  // Sortable column with DataTableColumnHeader (recommended)
  helper.accessor('name', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
    cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    enableSorting: true,
  }),

  // Non-sortable column
  helper.accessor('email', {
    header: 'Email',
    cell: ({ getValue }) => getValue(),
    enableSorting: false,
  }),

  // Sortable column with descending first (for dates)
  helper.accessor('createdAt', {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Creado" />,
    cell: ({ getValue }) => formatDate(getValue()),
    enableSorting: true,
    sortDescFirst: true,
  }),

  // Display column (no data accessor)
  helper.display({
    id: 'custom',
    header: 'Custom',
    cell: ({ row }) => <CustomComponent data={row.original} />,
  }),

  // Actions column with dropdown menu
  helper.actions({
    actions: (row) => [
      { label: 'Editar', icon: PencilIcon, onClick: () => onEdit(row) },
      { label: 'Eliminar', icon: TrashIcon, onClick: () => onDelete(row), variant: 'destructive' },
    ],
  }),
])
```

The column helper exposes three methods: `accessor`, `display`, and `actions`.
</column_definitions>

<server_side_pagination>
**ALL DataTables with list data MUST have pagination.** This requires backend support.

**Backend Requirements:**
| Layer | Skill | What to Add |
|-------|-------|-------------|
| Contract | `/contracts` | `limit`, `offset` in input; `totalCount` in output |
| Port | `/port` | `List{X}Result { items, totalCount }` type |
| Repository | `/repository` | Count query + paginated items query |
| Procedure | `/procedure` | Pass pagination params, return `totalCount` |

**Frontend Implementation:**
```tsx
const [pageIndex, setPageIndex] = useState(0)
const [pageSize, setPageSize] = useState(10)

const { data, isLoading } = useQuery({
  queryKey: ['users', { page: pageIndex, pageSize, search }],
  queryFn: () => api.users.list({
    limit: pageSize,
    offset: pageIndex * pageSize,
    search,
  }),
})

// Reset page when filters change
const handleSearchChange = (value: string) => {
  setSearch(value)
  setPageIndex(0)  // IMPORTANT: Reset to page 0
}

const handlePageChange = (newPageIndex: number, newPageSize: number) => {
  setPageIndex(newPageIndex)
  setPageSize(newPageSize)
}

<DataTable.Root
  data={data?.items ?? []}
  columns={columns}
  totalCount={data?.totalCount ?? 0}
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={handlePageChange}
  isLoading={isLoading}
>
  <DataTable.Pagination />
</DataTable.Root>
```

**Common Mistakes:**
1. **Missing `totalCount` from backend** - Pagination won't render
2. **Not resetting page on filter change** - User sees empty page
3. **Using client-side pagination** - Performance disaster with large datasets
</server_side_pagination>

<sorting>
**Column Setup:**
```tsx
helper.accessor('name', {
  header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
  enableSorting: true,
})
```

**Controlled State (for server-side sorting):**
```tsx
import type { SortingState } from '@tanstack/react-table'

const [sorting, setSorting] = useState<SortingState>([])
const sortField = sorting[0]?.id
const sortOrder = sorting[0]?.desc ? 'desc' : 'asc'

<DataTable.Root
  data={data}
  columns={columns}
  totalCount={totalCount}
  pageIndex={pageIndex}
  pageSize={pageSize}
  onPageChange={handlePageChange}
  sorting={sorting}
  onSortingChange={setSorting}
>
```

**Column Options:**
| Option | Type | Description |
|--------|------|-------------|
| `enableSorting` | `boolean` | Enable/disable sorting for the column |
| `sortDescFirst` | `boolean` | Start with descending order (useful for dates) |
| `sortingFn` | `string \| function` | Custom sorting function |
| `invertSorting` | `boolean` | Invert order (for rankings where lower is better) |
</sorting>

<state_handling>
States are handled automatically based on props:

| Prop | State Rendered |
|------|----------------|
| `isLoading={true}` | Skeleton loading |
| `error={{ message: "...", retry: fn }}` | Error with retry button |
| `data={[]}` (empty) | Empty state from `emptyState` prop |
</state_handling>

<compound_components>
| Component | Purpose |
|-----------|---------|
| `DataTable.Root` | Wraps the table, accepts data/columns/pagination state |
| `DataTable.Header` | Title, description, action buttons |
| `DataTable.Toolbar` | Container for search and custom filters |
| `DataTable.Search` | Debounced search input (300ms) with clear button |
| `DataTable.Content` | Table body, handles all states |
| `DataTable.Pagination` | Page navigation controls (zero props, reads from context) |
| `DataTable.ColumnHeader` | Sortable column header |
</compound_components>

<visual_styling>
The DataTable uses a **minimal, borderless design**:
- **No outer border** - Table sits cleanly in its container
- **Soft row dividers** - 40% opacity borders between rows
- **Clean headers** - Muted text that highlights on sort
- **Sorting via headers** - Click column headers to sort (no separate dropdown)

The Toolbar is for **search and filters only** - sorting is handled through column headers using `DataTableColumnHeader`.
</visual_styling>

<success_criteria>
When creating a DataTable:

- [ ] Import from `@/components/ui/data-table`
- [ ] Use `DataTable.Root` as the wrapper (not bare `DataTable`)
- [ ] Define columns with `createDataTableColumns`
- [ ] Use `DataTableColumnHeader` for sortable columns
- [ ] Pass `totalCount`, `pageIndex`, `pageSize`, `onPageChange` to `DataTable.Root`
- [ ] Use `<DataTable.Pagination />` with zero props
- [ ] Reset pageIndex when filters change
- [ ] Handle loading and error states
- [ ] Provide meaningful empty state
- [ ] Backend returns `{ items, totalCount }` structure
</success_criteria>

<backend_skills>
When creating a new DataTable with server-side pagination, update:

1. **`/contracts`** - Add `limit`/`offset` input, `totalCount` output
2. **`/port`** - Define `List{X}Result` type with `totalCount`
3. **`/repository`** - Add count query before paginated items query
4. **`/procedure`** - Pass pagination params, return `totalCount`

**Without these backend changes, `DataTable.Pagination` will not work.**
</backend_skills>

<resources>
For detailed prop types and advanced patterns, see `references/api_reference.md`.
</resources>
