import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/api-client'
import { handleMutationError } from '@/lib/api-errors'

/**
 * Hook to update an existing exercise.
 * Invalidates exercise list and detail cache on success.
 * @returns Mutation result with updateExercise function
 */
export function useUpdateExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.exercises.update.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.exercises.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error al actualizar el ejercicio' })
    },
  })
}
