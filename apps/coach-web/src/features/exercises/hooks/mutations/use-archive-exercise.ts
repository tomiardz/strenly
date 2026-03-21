import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/api-client'
import { handleMutationError } from '@/lib/api-errors'

/**
 * Hook to archive an exercise (set status to inactive).
 * Invalidates exercise list cache on success.
 * @returns Mutation result with archiveExercise function
 */
export function useArchiveExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.exercises.archive.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.exercises.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error al archivar el ejercicio' })
    },
  })
}
