import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/lib/api-client'

/**
 * Hook to fetch dashboard summary statistics.
 * Uses the dedicated dashboard summary endpoint for all stats in a single request.
 *
 * @returns Dashboard summary data, loading state, error state, and refetch function
 */
export function useDashboardStats() {
  const { data, isLoading, isError, refetch } = useQuery(orpc.dashboard.summary.queryOptions({}))

  return { data, isLoading, isError, refetch }
}
