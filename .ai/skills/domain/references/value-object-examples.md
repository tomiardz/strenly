# Value Object Examples

> Stack: **neverthrow** for Result types.
> Location: `{core}/domain/value-objects/`

## Table of Contents

- [Pattern 1: Constrained Type (Enum-like)](#pattern-1-constrained-type-enum-like)
- [Pattern 2: Validated Type (Complex Rules)](#pattern-2-validated-type-complex-rules)
- [Pattern 3: Composite Value Object](#pattern-3-composite-value-object)
- [Pattern 4: Range Value Object](#pattern-4-range-value-object)
- [Pattern 5: String Parsing Value Object](#pattern-5-string-parsing-value-object)
- [Pattern 6: Embedded/Child Value Object](#pattern-6-embeddedchild-value-object)
- [When NOT to Create a Value Object](#when-not-to-create-a-value-object)

---

## Pattern 1: Constrained Type (Enum-like)

Use when you have a fixed set of valid values with optional derived behavior.

```typescript
// {core}/domain/value-objects/status.ts

// The canonical list of valid values
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
] as const

// Type derived from the array
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Type guard for runtime validation
export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus)
}

// Derived behavior: group statuses by state
export type StatusGroup = 'active' | 'completed' | 'cancelled'

const STATUS_GROUPS: Record<OrderStatus, StatusGroup> = {
  pending: 'active',
  confirmed: 'active',
  shipped: 'active',
  delivered: 'completed',
  cancelled: 'cancelled',
}

export function getStatusGroup(status: OrderStatus): StatusGroup {
  return STATUS_GROUPS[status]
}

// Check if status allows modifications
export function isEditable(status: OrderStatus): boolean {
  return status === 'pending' || status === 'confirmed'
}
```

---

## Pattern 2: Validated Type (Complex Rules)

Use when the value has validation rules beyond simple type checking.

```typescript
// {core}/domain/value-objects/email.ts
import { err, ok, type Result } from 'neverthrow'

export type Email = {
  readonly value: string
  readonly domain: string
  readonly local: string
}

export type EmailError = { type: 'INVALID_EMAIL'; message: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function createEmail(input: string): Result<Email, EmailError> {
  const trimmed = input.trim().toLowerCase()

  if (!EMAIL_REGEX.test(trimmed)) {
    return err({ type: 'INVALID_EMAIL', message: 'Invalid email format' })
  }

  const [local, domain] = trimmed.split('@')

  return ok({
    value: trimmed,
    domain,
    local,
  })
}

// Helper to check domain
export function isFromDomain(email: Email, domain: string): boolean {
  return email.domain === domain.toLowerCase()
}
```

---

## Pattern 3: Composite Value Object

Use when multiple fields together form a meaningful concept.

```typescript
// {core}/domain/value-objects/money.ts
import { err, ok, type Result } from 'neverthrow'

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL'] as const
export type Currency = (typeof CURRENCIES)[number]

export type Money = {
  readonly amount: number      // In cents/smallest unit
  readonly currency: Currency
}

export type MoneyError =
  | { type: 'NEGATIVE_AMOUNT'; message: string }
  | { type: 'CURRENCY_MISMATCH'; message: string }

export function createMoney(amount: number, currency: Currency): Result<Money, MoneyError> {
  if (amount < 0) {
    return err({ type: 'NEGATIVE_AMOUNT', message: 'Amount cannot be negative' })
  }

  return ok({ amount, currency })
}

// Operations that preserve immutability
export function addMoney(a: Money, b: Money): Result<Money, MoneyError> {
  if (a.currency !== b.currency) {
    return err({
      type: 'CURRENCY_MISMATCH',
      message: `Cannot add ${a.currency} and ${b.currency}`
    })
  }

  return ok({ amount: a.amount + b.amount, currency: a.currency })
}

export function multiplyMoney(money: Money, factor: number): Money {
  return { amount: Math.round(money.amount * factor), currency: money.currency }
}

// Value equality
export function moneyEquals(a: Money, b: Money): boolean {
  return a.amount === b.amount && a.currency === b.currency
}

// Display
export function formatMoney(money: Money): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: money.currency,
  })
  return formatter.format(money.amount / 100)
}
```

---

## Pattern 4: Range Value Object

Use when a value represents a range with min/max constraints.

```typescript
// {core}/domain/value-objects/date-range.ts
import { err, ok, type Result } from 'neverthrow'

export type DateRange = {
  readonly start: Date
  readonly end: Date
}

export type DateRangeError =
  | { type: 'END_BEFORE_START'; message: string }
  | { type: 'RANGE_TOO_LONG'; message: string }

const MAX_RANGE_DAYS = 365

export function createDateRange(start: Date, end: Date): Result<DateRange, DateRangeError> {
  if (end <= start) {
    return err({ type: 'END_BEFORE_START', message: 'End date must be after start date' })
  }

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > MAX_RANGE_DAYS) {
    return err({
      type: 'RANGE_TOO_LONG',
      message: `Range cannot exceed ${MAX_RANGE_DAYS} days`
    })
  }

  return ok({ start, end })
}

// Query methods
export function containsDate(range: DateRange, date: Date): boolean {
  return date >= range.start && date <= range.end
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && a.end >= b.start
}

export function getDurationDays(range: DateRange): number {
  return Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24))
}
```

---

## Pattern 5: String Parsing Value Object

Use when a value is input as a string but has internal structure.

```typescript
// {core}/domain/value-objects/phone-number.ts
import { err, ok, type Result } from 'neverthrow'

export type PhoneNumber = {
  readonly countryCode: string
  readonly number: string
  readonly formatted: string
}

export type PhoneError = { type: 'INVALID_PHONE'; message: string }

// Accepts various formats: +1234567890, 123-456-7890, (123) 456-7890
export function createPhoneNumber(input: string): Result<PhoneNumber, PhoneError> {
  // Remove all non-digit characters except leading +
  const hasPlus = input.startsWith('+')
  const digits = input.replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 15) {
    return err({ type: 'INVALID_PHONE', message: 'Phone number must be 10-15 digits' })
  }

  // Extract country code and number
  let countryCode: string
  let number: string

  if (hasPlus && digits.length > 10) {
    countryCode = digits.slice(0, digits.length - 10)
    number = digits.slice(-10)
  } else {
    countryCode = '1' // Default to US
    number = digits.slice(-10)
  }

  // Format for display
  const formatted = `+${countryCode} (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`

  return ok({ countryCode, number, formatted })
}

// For international comparison
export function phoneNumbersEqual(a: PhoneNumber, b: PhoneNumber): boolean {
  return a.countryCode === b.countryCode && a.number === b.number
}
```

---

## Pattern 6: Embedded/Child Value Object

Use when a VO exists only as part of an Entity (no independent lifecycle).

```typescript
// {core}/domain/value-objects/address.ts
import { err, ok, type Result } from 'neverthrow'

// No ID - this VO is always embedded in an Entity
export type Address = {
  readonly street: string
  readonly city: string
  readonly state: string
  readonly postalCode: string
  readonly country: string
}

export type AddressError =
  | { type: 'STREET_REQUIRED'; message: string }
  | { type: 'CITY_REQUIRED'; message: string }
  | { type: 'INVALID_POSTAL_CODE'; message: string }

type CreateAddressInput = {
  street: string
  city: string
  state: string
  postalCode: string
  country: string
}

export function createAddress(input: CreateAddressInput): Result<Address, AddressError> {
  const street = input.street.trim()
  if (!street) {
    return err({ type: 'STREET_REQUIRED', message: 'Street address is required' })
  }

  const city = input.city.trim()
  if (!city) {
    return err({ type: 'CITY_REQUIRED', message: 'City is required' })
  }

  // Basic postal code validation (could be more specific per country)
  const postalCode = input.postalCode.trim()
  if (postalCode.length < 3 || postalCode.length > 10) {
    return err({ type: 'INVALID_POSTAL_CODE', message: 'Invalid postal code' })
  }

  return ok({
    street,
    city,
    state: input.state.trim(),
    postalCode,
    country: input.country.trim(),
  })
}

// Reconstitute from database (no validation needed)
export function reconstituteAddress(props: Address): Address {
  return { ...props }
}

// Format for display
export function formatAddress(address: Address): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`
}
```

---

## When NOT to Create a Value Object

**Just use a type alias when:**
- The value is a simple enum-like type with no behavior
- There's no validation beyond type checking
- The concept is not reused across entities

```typescript
// Simple types - no need for full VO treatment
export type Priority = 'low' | 'medium' | 'high'
export type UserRole = 'admin' | 'member' | 'viewer'

// Inline in entity
export type Task = {
  readonly id: string
  readonly priority: 'low' | 'medium' | 'high'  // Simple enough inline
}
```

**Create a Value Object when:**
- Validation rules exist beyond type checking
- The value has derived behavior (methods/functions)
- The value is reused across multiple entities
- The value represents a distinct domain concept
