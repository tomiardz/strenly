/**
 * Static auth mock data for E2E tests.
 * Shapes match Better-Auth's getSession() and organization.list() responses.
 */

/** GET /api/auth/get-session response */
export const MOCK_SESSION = {
  user: {
    id: 'user-e2e-test-001',
    name: 'Test User',
    email: 'test@strenly.app',
    image: null,
  },
  session: {
    id: 'sess-e2e-test-001',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
}

/** GET /api/auth/organization/list-organizations response */
export const MOCK_ORGANIZATIONS = [
  {
    id: 'org-seed-test-001',
    name: 'Test Organization',
    slug: 'test',
    logo: null,
    role: 'owner',
    metadata: { type: 'gym', status: 'active' },
    createdAt: '2024-01-01T00:00:00.000Z',
  },
]
