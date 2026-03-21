import type { Page } from '@playwright/test'
import { MOCK_ORGANIZATIONS, MOCK_SESSION } from './mock-auth'
import { filterExercises } from './mock-exercises'
import { MOCK_PROGRAM } from './mock-program'

/**
 * Register all page.route() handlers to mock API calls.
 * Must be called BEFORE any navigation (page.goto).
 *
 * IMPORTANT: Playwright evaluates routes in REVERSE registration order (LIFO).
 * Register catch-all routes FIRST, specific routes AFTER so specific ones win.
 *
 * oRPC URL format: POST {baseUrl}/rpc/{procedure/path} with body { json: input }
 * Better-Auth URL format: GET {baseUrl}/api/auth/{endpoint}
 */
export async function setupMocks(page: Page) {
  // ── oRPC mutation catch-all (register FIRST — lowest priority) ──

  await page.route('**/rpc/programs/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ json: { success: true } }),
    })
  })

  // ── oRPC data routes (register AFTER catch-all — higher priority) ──

  await page.route('**/rpc/programs/get*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ json: MOCK_PROGRAM }),
    })
  })

  await page.route('**/rpc/exercises/list*', async (route) => {
    const body = route.request().postData()
    let search: string | undefined
    let limit = 100

    if (body) {
      try {
        const parsed = JSON.parse(body)
        // oRPC wraps input in { json: { ... } }
        const input = parsed.json ?? parsed
        search = input.search
        if (input.limit) limit = input.limit
      } catch {
        // Ignore parse errors, return full list
      }
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ json: filterExercises(search, limit) }),
    })
  })

  // ── Auth routes ───────────────────────────────────────────

  await page.route('**/api/auth/get-session*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    })
  })

  await page.route('**/api/auth/organization/list*', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ORGANIZATIONS),
    })
  })

  await page.route('**/api/auth/organization/get-full-organization*', (route) => {
    const org = MOCK_ORGANIZATIONS[0]
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...org,
        members: [
          {
            id: 'member-001',
            organizationId: org?.id,
            userId: MOCK_SESSION.user.id,
            role: 'owner',
            createdAt: org?.createdAt,
            user: {
              id: MOCK_SESSION.user.id,
              name: MOCK_SESSION.user.name,
              email: MOCK_SESSION.user.email,
              image: MOCK_SESSION.user.image,
            },
          },
        ],
        invitations: [],
      }),
    })
  })
}
