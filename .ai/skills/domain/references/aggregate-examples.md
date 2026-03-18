# Aggregate Examples

> Stack: **neverthrow** for Result types.
> Location: `{core}/domain/entities/`

## Table of Contents

- [Understanding Aggregates](#understanding-aggregates)
- [Pattern 1: Simple Aggregate with Child Entities](#pattern-1-simple-aggregate-with-child-entities)
- [Pattern 2: Nested Aggregate (Multiple Levels)](#pattern-2-nested-aggregate-multiple-levels)
- [Pattern 3: Aggregate with Business Rules Across Children](#pattern-3-aggregate-with-business-rules-across-children)
- [Repository Pattern for Aggregates](#repository-pattern-for-aggregates)
- [When to Use Aggregates vs Separate Entities](#when-to-use-aggregates-vs-separate-entities)

---

## Understanding Aggregates

An Aggregate is a cluster of domain objects (Entities and Value Objects) treated as a single unit for data changes. The Aggregate Root is the only entity through which external code can interact with the aggregate.

### Key Principles

1. **Consistency Boundary**: All invariants within the aggregate are enforced together
2. **Single Entry Point**: Only the root can be accessed from outside
3. **Transactional Unit**: Saved and loaded as a complete unit
4. **Identity**: Only the root has a globally unique ID
5. **Ownership**: Children cannot exist without the root

### Identifying Aggregate Boundaries

Ask: "If I delete X, what else MUST be deleted?"

- Delete an Order → Delete its OrderItems (children owned by Order)
- Delete a Customer → Customer's Orders remain (separate aggregate)
- Delete a ShoppingCart → Delete its CartItems (children owned by Cart)

---

## Pattern 1: Simple Aggregate with Child Entities

The most common pattern — a root entity that owns child entities.

```typescript
// {core}/domain/entities/order.ts
import { err, ok, type Result } from 'neverthrow'

// ===== VALUE OBJECTS =====

export type OrderItem = {
  readonly id: string           // Local ID within aggregate
  readonly productId: string    // Reference to external entity
  readonly productName: string  // Snapshot at time of order
  readonly quantity: number
  readonly unitPrice: number    // In cents, snapshot at time of order
}

// ===== AGGREGATE ROOT =====

export type OrderStatus = 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export type Order = {
  readonly id: string
  readonly customerId: string           // Reference to external entity
  readonly status: OrderStatus
  readonly items: readonly OrderItem[]  // Owned children
  readonly shippingAddress: Address     // Embedded Value Object
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type OrderError =
  | { type: 'EMPTY_ORDER'; message: string }
  | { type: 'MAX_ITEMS_EXCEEDED'; message: string }
  | { type: 'ITEM_NOT_FOUND'; message: string }
  | { type: 'INVALID_QUANTITY'; message: string }
  | { type: 'ORDER_NOT_EDITABLE'; message: string }
  | { type: 'INVALID_STATUS_TRANSITION'; message: string }

const MAX_ITEMS = 100

// ===== FACTORY =====

type CreateOrderInput = {
  id: string
  customerId: string
  shippingAddress: Address
}

export function createOrder(input: CreateOrderInput): Result<Order, OrderError> {
  const now = new Date()

  return ok({
    id: input.id,
    customerId: input.customerId,
    status: 'draft',
    items: [],
    shippingAddress: input.shippingAddress,
    createdAt: now,
    updatedAt: now,
  })
}

// ===== INVARIANT CHECKS =====

function isEditable(order: Order): boolean {
  return order.status === 'draft'
}

function assertEditable(order: Order): Result<void, OrderError> {
  if (!isEditable(order)) {
    return err({ type: 'ORDER_NOT_EDITABLE', message: 'Order can only be modified in draft status' })
  }
  return ok(undefined)
}

// ===== CHILD ENTITY OPERATIONS =====

type AddItemInput = {
  itemId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
}

export function addItem(order: Order, input: AddItemInput): Result<Order, OrderError> {
  const editCheck = assertEditable(order)
  if (editCheck.isErr()) return err(editCheck.error)

  if (order.items.length >= MAX_ITEMS) {
    return err({ type: 'MAX_ITEMS_EXCEEDED', message: `Order cannot have more than ${MAX_ITEMS} items` })
  }

  if (input.quantity < 1) {
    return err({ type: 'INVALID_QUANTITY', message: 'Quantity must be at least 1' })
  }

  const newItem: OrderItem = {
    id: input.itemId,
    productId: input.productId,
    productName: input.productName,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  }

  return ok({
    ...order,
    items: [...order.items, newItem],
    updatedAt: new Date(),
  })
}

export function removeItem(order: Order, itemId: string): Result<Order, OrderError> {
  const editCheck = assertEditable(order)
  if (editCheck.isErr()) return err(editCheck.error)

  const itemIndex = order.items.findIndex(item => item.id === itemId)
  if (itemIndex === -1) {
    return err({ type: 'ITEM_NOT_FOUND', message: `Item ${itemId} not found in order` })
  }

  return ok({
    ...order,
    items: order.items.filter(item => item.id !== itemId),
    updatedAt: new Date(),
  })
}

export function updateItemQuantity(
  order: Order,
  itemId: string,
  quantity: number
): Result<Order, OrderError> {
  const editCheck = assertEditable(order)
  if (editCheck.isErr()) return err(editCheck.error)

  if (quantity < 1) {
    return err({ type: 'INVALID_QUANTITY', message: 'Quantity must be at least 1' })
  }

  const itemIndex = order.items.findIndex(item => item.id === itemId)
  if (itemIndex === -1) {
    return err({ type: 'ITEM_NOT_FOUND', message: `Item ${itemId} not found in order` })
  }

  const updatedItems = order.items.map(item =>
    item.id === itemId ? { ...item, quantity } : item
  )

  return ok({
    ...order,
    items: updatedItems,
    updatedAt: new Date(),
  })
}

// ===== STATE TRANSITIONS =====

export function confirmOrder(order: Order): Result<Order, OrderError> {
  if (order.status !== 'draft') {
    return err({
      type: 'INVALID_STATUS_TRANSITION',
      message: `Cannot confirm order with status '${order.status}'`,
    })
  }

  if (order.items.length === 0) {
    return err({ type: 'EMPTY_ORDER', message: 'Cannot confirm empty order' })
  }

  return ok({ ...order, status: 'confirmed', updatedAt: new Date() })
}

// ===== QUERY HELPERS =====

export function calculateTotal(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function getItemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0)
}
```

---

## Pattern 2: Nested Aggregate (Multiple Levels)

Use when the aggregate has multiple levels of nesting.

```typescript
// {core}/domain/entities/document.ts
import { err, ok, type Result } from 'neverthrow'

// ===== CHILD ENTITY: Section =====

export type Section = {
  readonly id: string
  readonly title: string
  readonly content: string
  readonly orderIndex: number
}

// ===== CHILD ENTITY: Chapter (owns Sections) =====

export type Chapter = {
  readonly id: string
  readonly title: string
  readonly orderIndex: number
  readonly sections: readonly Section[]
}

// ===== AGGREGATE ROOT: Document =====

export type Document = {
  readonly id: string
  readonly organizationId: string
  readonly title: string
  readonly chapters: readonly Chapter[]
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type DocumentError =
  | { type: 'TITLE_REQUIRED'; message: string }
  | { type: 'CHAPTER_NOT_FOUND'; message: string }
  | { type: 'SECTION_NOT_FOUND'; message: string }
  | { type: 'MAX_CHAPTERS_EXCEEDED'; message: string }
  | { type: 'MAX_SECTIONS_EXCEEDED'; message: string }

const MAX_CHAPTERS = 50
const MAX_SECTIONS_PER_CHAPTER = 20

// ===== FACTORY =====

type CreateDocumentInput = {
  id: string
  organizationId: string
  title: string
}

export function createDocument(input: CreateDocumentInput): Result<Document, DocumentError> {
  const trimmedTitle = input.title.trim()
  if (!trimmedTitle) {
    return err({ type: 'TITLE_REQUIRED', message: 'Document title is required' })
  }

  const now = new Date()

  return ok({
    id: input.id,
    organizationId: input.organizationId,
    title: trimmedTitle,
    chapters: [],
    createdAt: now,
    updatedAt: now,
  })
}

// ===== CHAPTER OPERATIONS =====

type AddChapterInput = {
  chapterId: string
  title: string
}

export function addChapter(doc: Document, input: AddChapterInput): Result<Document, DocumentError> {
  if (doc.chapters.length >= MAX_CHAPTERS) {
    return err({ type: 'MAX_CHAPTERS_EXCEEDED', message: `Document cannot have more than ${MAX_CHAPTERS} chapters` })
  }

  const trimmedTitle = input.title.trim()
  if (!trimmedTitle) {
    return err({ type: 'TITLE_REQUIRED', message: 'Chapter title is required' })
  }

  const newChapter: Chapter = {
    id: input.chapterId,
    title: trimmedTitle,
    orderIndex: doc.chapters.length,
    sections: [],
  }

  return ok({
    ...doc,
    chapters: [...doc.chapters, newChapter],
    updatedAt: new Date(),
  })
}

export function removeChapter(doc: Document, chapterId: string): Result<Document, DocumentError> {
  const chapterIndex = doc.chapters.findIndex(ch => ch.id === chapterId)
  if (chapterIndex === -1) {
    return err({ type: 'CHAPTER_NOT_FOUND', message: `Chapter ${chapterId} not found` })
  }

  // Reindex remaining chapters
  const remainingChapters = doc.chapters
    .filter(ch => ch.id !== chapterId)
    .map((ch, index) => ({ ...ch, orderIndex: index }))

  return ok({
    ...doc,
    chapters: remainingChapters,
    updatedAt: new Date(),
  })
}

// ===== SECTION OPERATIONS (nested inside chapters) =====

type AddSectionInput = {
  chapterId: string
  sectionId: string
  title: string
  content: string
}

export function addSection(doc: Document, input: AddSectionInput): Result<Document, DocumentError> {
  const chapterIndex = doc.chapters.findIndex(ch => ch.id === input.chapterId)
  if (chapterIndex === -1) {
    return err({ type: 'CHAPTER_NOT_FOUND', message: `Chapter ${input.chapterId} not found` })
  }

  const chapter = doc.chapters[chapterIndex]

  if (chapter.sections.length >= MAX_SECTIONS_PER_CHAPTER) {
    return err({
      type: 'MAX_SECTIONS_EXCEEDED',
      message: `Chapter cannot have more than ${MAX_SECTIONS_PER_CHAPTER} sections`,
    })
  }

  const newSection: Section = {
    id: input.sectionId,
    title: input.title.trim(),
    content: input.content,
    orderIndex: chapter.sections.length,
  }

  const updatedChapter: Chapter = {
    ...chapter,
    sections: [...chapter.sections, newSection],
  }

  const updatedChapters = doc.chapters.map((ch, idx) =>
    idx === chapterIndex ? updatedChapter : ch
  )

  return ok({
    ...doc,
    chapters: updatedChapters,
    updatedAt: new Date(),
  })
}

export function updateSectionContent(
  doc: Document,
  chapterId: string,
  sectionId: string,
  content: string
): Result<Document, DocumentError> {
  const chapterIndex = doc.chapters.findIndex(ch => ch.id === chapterId)
  if (chapterIndex === -1) {
    return err({ type: 'CHAPTER_NOT_FOUND', message: `Chapter ${chapterId} not found` })
  }

  const chapter = doc.chapters[chapterIndex]
  const sectionIndex = chapter.sections.findIndex(s => s.id === sectionId)
  if (sectionIndex === -1) {
    return err({ type: 'SECTION_NOT_FOUND', message: `Section ${sectionId} not found` })
  }

  const updatedSections = chapter.sections.map((s, idx) =>
    idx === sectionIndex ? { ...s, content } : s
  )

  const updatedChapter: Chapter = { ...chapter, sections: updatedSections }
  const updatedChapters = doc.chapters.map((ch, idx) =>
    idx === chapterIndex ? updatedChapter : ch
  )

  return ok({
    ...doc,
    chapters: updatedChapters,
    updatedAt: new Date(),
  })
}

// ===== REORDERING =====

export function reorderChapters(
  doc: Document,
  chapterIds: readonly string[]
): Result<Document, DocumentError> {
  // Verify all chapters exist
  for (const id of chapterIds) {
    if (!doc.chapters.find(ch => ch.id === id)) {
      return err({ type: 'CHAPTER_NOT_FOUND', message: `Chapter ${id} not found` })
    }
  }

  const reorderedChapters = chapterIds.map((id, index) => {
    const chapter = doc.chapters.find(ch => ch.id === id)!
    return { ...chapter, orderIndex: index }
  })

  return ok({
    ...doc,
    chapters: reorderedChapters,
    updatedAt: new Date(),
  })
}
```

---

## Pattern 3: Aggregate with Business Rules Across Children

Use when invariants span multiple child entities.

```typescript
// {core}/domain/entities/shopping-cart.ts
import { err, ok, type Result } from 'neverthrow'

export type CartItem = {
  readonly id: string
  readonly productId: string
  readonly quantity: number
  readonly unitPrice: number
}

export type ShoppingCart = {
  readonly id: string
  readonly customerId: string
  readonly items: readonly CartItem[]
  readonly couponCode: string | null
  readonly discountPercentage: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CartError =
  | { type: 'ITEM_NOT_FOUND'; message: string }
  | { type: 'INVALID_QUANTITY'; message: string }
  | { type: 'CART_LIMIT_EXCEEDED'; message: string }
  | { type: 'COUPON_ALREADY_APPLIED'; message: string }
  | { type: 'MINIMUM_NOT_MET'; message: string }

const MAX_ITEMS = 50
const MAX_QUANTITY_PER_ITEM = 99
const MINIMUM_FOR_CHECKOUT = 1000 // $10.00 in cents

// ===== AGGREGATE INVARIANT: Total quantity across all items =====

function getTotalQuantity(cart: ShoppingCart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity, 0)
}

function assertWithinLimits(cart: ShoppingCart, additionalQuantity: number): Result<void, CartError> {
  const totalAfter = getTotalQuantity(cart) + additionalQuantity
  if (totalAfter > MAX_ITEMS) {
    return err({
      type: 'CART_LIMIT_EXCEEDED',
      message: `Cart cannot exceed ${MAX_ITEMS} total items`,
    })
  }
  return ok(undefined)
}

// ===== OPERATIONS =====

type AddToCartInput = {
  itemId: string
  productId: string
  quantity: number
  unitPrice: number
}

export function addToCart(cart: ShoppingCart, input: AddToCartInput): Result<ShoppingCart, CartError> {
  if (input.quantity < 1 || input.quantity > MAX_QUANTITY_PER_ITEM) {
    return err({ type: 'INVALID_QUANTITY', message: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}` })
  }

  // Check existing item for same product
  const existingItem = cart.items.find(item => item.productId === input.productId)

  if (existingItem) {
    const newQuantity = existingItem.quantity + input.quantity
    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      return err({
        type: 'INVALID_QUANTITY',
        message: `Cannot have more than ${MAX_QUANTITY_PER_ITEM} of the same item`,
      })
    }

    const limitCheck = assertWithinLimits(cart, input.quantity)
    if (limitCheck.isErr()) return err(limitCheck.error)

    const updatedItems = cart.items.map(item =>
      item.productId === input.productId
        ? { ...item, quantity: newQuantity }
        : item
    )

    return ok({ ...cart, items: updatedItems, updatedAt: new Date() })
  }

  // New item
  const limitCheck = assertWithinLimits(cart, input.quantity)
  if (limitCheck.isErr()) return err(limitCheck.error)

  const newItem: CartItem = {
    id: input.itemId,
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  }

  return ok({
    ...cart,
    items: [...cart.items, newItem],
    updatedAt: new Date(),
  })
}

export function applyCoupon(
  cart: ShoppingCart,
  couponCode: string,
  discountPercentage: number
): Result<ShoppingCart, CartError> {
  if (cart.couponCode !== null) {
    return err({ type: 'COUPON_ALREADY_APPLIED', message: 'A coupon is already applied' })
  }

  return ok({
    ...cart,
    couponCode,
    discountPercentage,
    updatedAt: new Date(),
  })
}

// ===== CHECKOUT VALIDATION (cross-child invariant) =====

export function validateForCheckout(cart: ShoppingCart): Result<void, CartError> {
  const subtotal = calculateSubtotal(cart)

  if (subtotal < MINIMUM_FOR_CHECKOUT) {
    return err({
      type: 'MINIMUM_NOT_MET',
      message: `Minimum order amount is $${(MINIMUM_FOR_CHECKOUT / 100).toFixed(2)}`,
    })
  }

  return ok(undefined)
}

// ===== CALCULATIONS =====

export function calculateSubtotal(cart: ShoppingCart): number {
  return cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export function calculateDiscount(cart: ShoppingCart): number {
  const subtotal = calculateSubtotal(cart)
  return Math.round(subtotal * (cart.discountPercentage / 100))
}

export function calculateTotal(cart: ShoppingCart): number {
  return calculateSubtotal(cart) - calculateDiscount(cart)
}
```

---

## Repository Pattern for Aggregates

Aggregates are loaded and saved as complete units:

```typescript
// {core}/ports/order-repository.port.ts
import type { ResultAsync } from 'neverthrow'
import type { Order } from '../entities/order'
import type { RepositoryError } from '../errors'

// Context type is defined per project (e.g., OrganizationContext)
export interface OrderRepository {
  // Load complete aggregate
  findById(ctx: Context, id: string): ResultAsync<Order | null, RepositoryError>

  // Save complete aggregate (insert or update)
  save(ctx: Context, order: Order): ResultAsync<void, RepositoryError>

  // List aggregates (may return partial data for performance)
  findByCustomerId(
    ctx: Context,
    customerId: string
  ): ResultAsync<Order[], RepositoryError>
}
```

**Important**: The repository handles persisting all child entities in a single transaction. The domain doesn't know about the database structure.

---

## When to Use Aggregates vs Separate Entities

| Scenario | Recommendation |
|----------|----------------|
| Children can't exist without parent | Aggregate |
| Children share lifecycle with parent | Aggregate |
| Need to enforce invariants across children | Aggregate |
| Children are referenced independently | Separate Entities |
| Children have their own complex lifecycle | Separate Entities |
| Performance requires loading children separately | Consider separate Entities |

**Start small**: Begin with separate entities and introduce aggregates when you identify consistency boundaries that need enforcement.
