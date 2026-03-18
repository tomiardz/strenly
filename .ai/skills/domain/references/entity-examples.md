# Entity Examples

> Stack: **neverthrow** for Result types.
> Location: `{core}/domain/entities/`

## Table of Contents

- [Pattern 1: Standard Entity](#pattern-1-standard-entity)
- [Pattern 2: Entity with State Machine](#pattern-2-entity-with-state-machine)
- [Pattern 3: Entity with Computed State](#pattern-3-entity-with-computed-state)
- [Pattern 4: Entity with Mutation Helpers](#pattern-4-entity-with-mutation-helpers)
- [Pattern 5: Entity with Optional Fields](#pattern-5-entity-with-optional-fields)
- [ID Generation Rule](#id-generation-rule)

---

## Pattern 1: Standard Entity

The most common pattern — an entity with identity, validation, and lifecycle.

```typescript
// {core}/domain/entities/customer.ts
import { err, ok, type Result } from 'neverthrow'

export type CustomerStatus = 'active' | 'inactive' | 'suspended'

export type Customer = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly email: string
  readonly status: CustomerStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type CustomerError =
  | { type: 'NAME_REQUIRED'; message: string }
  | { type: 'NAME_TOO_LONG'; message: string }
  | { type: 'INVALID_EMAIL'; message: string }

type CreateCustomerInput = {
  id: string                    // Provided by use case (via generateId)
  organizationId: string
  name: string
  email: string
  status?: CustomerStatus
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createCustomer(input: CreateCustomerInput): Result<Customer, CustomerError> {
  // Validate name
  const trimmedName = input.name.trim()
  if (trimmedName.length === 0) {
    return err({ type: 'NAME_REQUIRED', message: 'Name is required' })
  }
  if (trimmedName.length > 100) {
    return err({ type: 'NAME_TOO_LONG', message: 'Name must not exceed 100 characters' })
  }

  // Validate email
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(email)) {
    return err({ type: 'INVALID_EMAIL', message: 'Invalid email format' })
  }

  const now = new Date()

  return ok({
    id: input.id,
    organizationId: input.organizationId,
    name: trimmedName,
    email,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  })
}

// Reconstitute from database (skip validation - data is already valid)
export function reconstituteCustomer(props: Customer): Customer {
  return { ...props }
}

// Query helpers using Pick<> for minimal requirements
export const isActive = (customer: Pick<Customer, 'status'>): boolean =>
  customer.status === 'active'

export const canReceiveNotifications = (customer: Pick<Customer, 'status' | 'email'>): boolean =>
  customer.status === 'active' && customer.email.length > 0
```

---

## Pattern 2: Entity with State Machine

Use when the entity has a status that can only transition in specific ways.

```typescript
// {core}/domain/entities/order.ts
import { err, ok, type Result } from 'neverthrow'

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export type Order = {
  readonly id: string
  readonly customerId: string
  readonly status: OrderStatus
  readonly totalAmount: number
  readonly confirmedAt: Date | null
  readonly shippedAt: Date | null
  readonly deliveredAt: Date | null
  readonly cancelledAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type OrderError =
  | { type: 'INVALID_AMOUNT'; message: string }
  | { type: 'INVALID_STATUS_TRANSITION'; message: string; from: OrderStatus; to: OrderStatus }

// Define valid state transitions
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

// Generic transition function
export function transitionStatus(
  order: Order,
  newStatus: OrderStatus
): Result<Order, OrderError> {
  if (order.status === newStatus) {
    return ok(order) // No-op if same status
  }

  if (!canTransitionTo(order.status, newStatus)) {
    return err({
      type: 'INVALID_STATUS_TRANSITION',
      message: `Cannot transition from ${order.status} to ${newStatus}`,
      from: order.status,
      to: newStatus,
    })
  }

  const now = new Date()
  const timestamps: Partial<Order> = { updatedAt: now }

  // Set appropriate timestamp for state
  switch (newStatus) {
    case 'confirmed':
      timestamps.confirmedAt = now
      break
    case 'shipped':
      timestamps.shippedAt = now
      break
    case 'delivered':
      timestamps.deliveredAt = now
      break
    case 'cancelled':
      timestamps.cancelledAt = now
      break
  }

  return ok({ ...order, status: newStatus, ...timestamps })
}

// Semantic helper functions (wrap generic transition)
export function confirmOrder(order: Order): Result<Order, OrderError> {
  return transitionStatus(order, 'confirmed')
}

export function shipOrder(order: Order): Result<Order, OrderError> {
  return transitionStatus(order, 'shipped')
}

export function deliverOrder(order: Order): Result<Order, OrderError> {
  return transitionStatus(order, 'delivered')
}

export function cancelOrder(order: Order): Result<Order, OrderError> {
  return transitionStatus(order, 'cancelled')
}

// Query helpers
export function isPending(order: Pick<Order, 'status'>): boolean {
  return order.status === 'pending'
}

export function isEditable(order: Pick<Order, 'status'>): boolean {
  return order.status === 'pending' || order.status === 'confirmed'
}

export function isFinal(order: Pick<Order, 'status'>): boolean {
  return order.status === 'delivered' || order.status === 'cancelled'
}
```

---

## Pattern 3: Entity with Computed State

Use when the state is derived from data rather than stored directly.

```typescript
// {core}/domain/entities/subscription.ts
import { err, ok, type Result } from 'neverthrow'

export type SubscriptionState = 'trial' | 'active' | 'expired' | 'cancelled'

export type Subscription = {
  readonly id: string
  readonly organizationId: string
  readonly planId: string
  readonly isCancelled: boolean
  readonly trialEndsAt: Date | null
  readonly currentPeriodEnd: Date
  readonly createdAt: Date
}

export type SubscriptionError =
  | { type: 'INVALID_PERIOD'; message: string }
  | { type: 'ALREADY_CANCELLED'; message: string }

type CreateSubscriptionInput = {
  id: string
  organizationId: string
  planId: string
  trialEndsAt?: Date | null
  currentPeriodEnd: Date
}

export function createSubscription(input: CreateSubscriptionInput): Result<Subscription, SubscriptionError> {
  const now = new Date()

  if (input.currentPeriodEnd <= now) {
    return err({ type: 'INVALID_PERIOD', message: 'Period end must be in the future' })
  }

  return ok({
    id: input.id,
    organizationId: input.organizationId,
    planId: input.planId,
    isCancelled: false,
    trialEndsAt: input.trialEndsAt ?? null,
    currentPeriodEnd: input.currentPeriodEnd,
    createdAt: now,
  })
}

// Reconstitute from database
export function reconstituteSubscription(props: Subscription): Subscription {
  return { ...props }
}

// State is COMPUTED from data, not stored
// Always pass `now` as parameter to keep functions pure and testable
type SubscriptionStateData = Pick<Subscription, 'isCancelled' | 'trialEndsAt' | 'currentPeriodEnd'>

export function getSubscriptionState(subscription: SubscriptionStateData, now: Date): SubscriptionState {
  if (subscription.isCancelled) return 'cancelled'

  // Check if in trial
  if (subscription.trialEndsAt && now < subscription.trialEndsAt) {
    return 'trial'
  }

  // Check if still active
  if (now < subscription.currentPeriodEnd) {
    return 'active'
  }

  return 'expired'
}

// Query helpers
export function isTrialing(subscription: SubscriptionStateData, now: Date): boolean {
  return getSubscriptionState(subscription, now) === 'trial'
}

export function hasAccess(subscription: SubscriptionStateData, now: Date): boolean {
  const state = getSubscriptionState(subscription, now)
  return state === 'trial' || state === 'active'
}

// Mutation helpers
export function cancelSubscription(subscription: Subscription): Result<Subscription, SubscriptionError> {
  if (subscription.isCancelled) {
    return err({ type: 'ALREADY_CANCELLED', message: 'Subscription is already cancelled' })
  }

  return ok({ ...subscription, isCancelled: true })
}

export function renewSubscription(subscription: Subscription, newPeriodEnd: Date): Subscription {
  return { ...subscription, currentPeriodEnd: newPeriodEnd }
}
```

---

## Pattern 4: Entity with Mutation Helpers

Use when the entity has multiple update operations that need validation.

```typescript
// {core}/domain/entities/product.ts
import { err, ok, type Result } from 'neverthrow'

export type Product = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly price: number            // In cents
  readonly stockQuantity: number
  readonly isActive: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type ProductError =
  | { type: 'NAME_REQUIRED'; message: string }
  | { type: 'PRICE_INVALID'; message: string }
  | { type: 'STOCK_INVALID'; message: string }
  | { type: 'INSUFFICIENT_STOCK'; message: string }

type CreateProductInput = {
  id: string
  organizationId: string
  name: string
  description?: string | null
  price: number
  stockQuantity?: number
}

export function createProduct(input: CreateProductInput): Result<Product, ProductError> {
  const trimmedName = input.name.trim()
  if (!trimmedName) {
    return err({ type: 'NAME_REQUIRED', message: 'Product name is required' })
  }

  if (input.price < 0) {
    return err({ type: 'PRICE_INVALID', message: 'Price cannot be negative' })
  }

  const stockQuantity = input.stockQuantity ?? 0
  if (stockQuantity < 0) {
    return err({ type: 'STOCK_INVALID', message: 'Stock cannot be negative' })
  }

  const now = new Date()

  return ok({
    id: input.id,
    organizationId: input.organizationId,
    name: trimmedName,
    description: input.description ?? null,
    price: input.price,
    stockQuantity,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

export function reconstituteProduct(props: Product): Product {
  return { ...props }
}

// Mutation helpers - all return Result for validation
export function updatePrice(product: Product, newPrice: number): Result<Product, ProductError> {
  if (newPrice < 0) {
    return err({ type: 'PRICE_INVALID', message: 'Price cannot be negative' })
  }

  return ok({ ...product, price: newPrice, updatedAt: new Date() })
}

export function addStock(product: Product, quantity: number): Result<Product, ProductError> {
  if (quantity < 0) {
    return err({ type: 'STOCK_INVALID', message: 'Quantity to add cannot be negative' })
  }

  return ok({
    ...product,
    stockQuantity: product.stockQuantity + quantity,
    updatedAt: new Date(),
  })
}

export function removeStock(product: Product, quantity: number): Result<Product, ProductError> {
  if (quantity < 0) {
    return err({ type: 'STOCK_INVALID', message: 'Quantity to remove cannot be negative' })
  }

  if (product.stockQuantity < quantity) {
    return err({
      type: 'INSUFFICIENT_STOCK',
      message: `Cannot remove ${quantity} items, only ${product.stockQuantity} in stock`,
    })
  }

  return ok({
    ...product,
    stockQuantity: product.stockQuantity - quantity,
    updatedAt: new Date(),
  })
}

export function deactivate(product: Product): Product {
  return { ...product, isActive: false, updatedAt: new Date() }
}

export function activate(product: Product): Product {
  return { ...product, isActive: true, updatedAt: new Date() }
}

// Query helpers
export function isInStock(product: Pick<Product, 'stockQuantity'>): boolean {
  return product.stockQuantity > 0
}

export function canBePurchased(product: Pick<Product, 'isActive' | 'stockQuantity'>): boolean {
  return product.isActive && product.stockQuantity > 0
}
```

---

## Pattern 5: Entity with Optional Fields

Use when the entity has many nullable/optional fields with a partial update function.

```typescript
// {core}/domain/entities/user-profile.ts
import { err, ok, type Result } from 'neverthrow'

export type UserProfile = {
  readonly id: string
  readonly userId: string
  readonly displayName: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly website: string | null
  readonly location: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export type UserProfileError =
  | { type: 'DISPLAY_NAME_REQUIRED'; message: string }
  | { type: 'DISPLAY_NAME_TOO_LONG'; message: string }
  | { type: 'BIO_TOO_LONG'; message: string }
  | { type: 'INVALID_URL'; message: string }

type CreateUserProfileInput = {
  id: string
  userId: string
  displayName: string
  bio?: string | null
  avatarUrl?: string | null
  website?: string | null
  location?: string | null
}

// Partial update type - all fields optional except for required context
type UpdateUserProfileInput = {
  displayName?: string
  bio?: string | null
  avatarUrl?: string | null
  website?: string | null
  location?: string | null
}

const MAX_BIO_LENGTH = 500

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function createUserProfile(input: CreateUserProfileInput): Result<UserProfile, UserProfileError> {
  const displayName = input.displayName.trim()
  if (!displayName) {
    return err({ type: 'DISPLAY_NAME_REQUIRED', message: 'Display name is required' })
  }
  if (displayName.length > 50) {
    return err({ type: 'DISPLAY_NAME_TOO_LONG', message: 'Display name must not exceed 50 characters' })
  }

  const bio = input.bio?.trim() || null
  if (bio && bio.length > MAX_BIO_LENGTH) {
    return err({ type: 'BIO_TOO_LONG', message: `Bio must not exceed ${MAX_BIO_LENGTH} characters` })
  }

  if (input.website && !isValidUrl(input.website)) {
    return err({ type: 'INVALID_URL', message: 'Website must be a valid URL' })
  }

  if (input.avatarUrl && !isValidUrl(input.avatarUrl)) {
    return err({ type: 'INVALID_URL', message: 'Avatar URL must be a valid URL' })
  }

  const now = new Date()

  return ok({
    id: input.id,
    userId: input.userId,
    displayName,
    bio,
    avatarUrl: input.avatarUrl ?? null,
    website: input.website ?? null,
    location: input.location?.trim() || null,
    createdAt: now,
    updatedAt: now,
  })
}

export function reconstituteUserProfile(props: UserProfile): UserProfile {
  return { ...props }
}

// Generic update function for partial updates
export function updateUserProfile(
  profile: UserProfile,
  updates: UpdateUserProfileInput
): Result<UserProfile, UserProfileError> {
  // Validate each provided field
  let displayName = profile.displayName
  if (updates.displayName !== undefined) {
    displayName = updates.displayName.trim()
    if (!displayName) {
      return err({ type: 'DISPLAY_NAME_REQUIRED', message: 'Display name is required' })
    }
    if (displayName.length > 50) {
      return err({ type: 'DISPLAY_NAME_TOO_LONG', message: 'Display name must not exceed 50 characters' })
    }
  }

  let bio = profile.bio
  if (updates.bio !== undefined) {
    bio = updates.bio?.trim() || null
    if (bio && bio.length > MAX_BIO_LENGTH) {
      return err({ type: 'BIO_TOO_LONG', message: `Bio must not exceed ${MAX_BIO_LENGTH} characters` })
    }
  }

  if (updates.website !== undefined && updates.website && !isValidUrl(updates.website)) {
    return err({ type: 'INVALID_URL', message: 'Website must be a valid URL' })
  }

  if (updates.avatarUrl !== undefined && updates.avatarUrl && !isValidUrl(updates.avatarUrl)) {
    return err({ type: 'INVALID_URL', message: 'Avatar URL must be a valid URL' })
  }

  return ok({
    ...profile,
    displayName,
    bio,
    avatarUrl: updates.avatarUrl !== undefined ? (updates.avatarUrl ?? null) : profile.avatarUrl,
    website: updates.website !== undefined ? (updates.website ?? null) : profile.website,
    location: updates.location !== undefined ? (updates.location?.trim() || null) : profile.location,
    updatedAt: new Date(),
  })
}
```

---

## ID Generation Rule

**The domain entity receives the ID as input. It does NOT generate IDs.**

ID generation is an infrastructure concern. The use case injects a `generateId` dependency:

```typescript
// In use case:
type Dependencies = {
  repository: CustomerRepository
  generateId: () => string  // Injected (e.g., nanoid, uuid)
}

export function createCustomerUseCase(deps: Dependencies) {
  return (input: CreateCustomerUseCaseInput) => {
    // Use case generates the ID
    const customerResult = createCustomer({
      id: deps.generateId(),
      organizationId: input.organizationId,
      name: input.name,
      email: input.email,
    })

    if (customerResult.isErr()) {
      return errAsync(mapToUseCaseError(customerResult.error))
    }

    return deps.repository.create(input.ctx, customerResult.value)
  }
}
```

This keeps the domain pure and testable — tests can pass predictable IDs.
