import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/api-client'
import { handleMutationError } from '@/lib/api-errors'

/**
 * Hook to clone an existing exercise.
 * Invalidates exercise list cache on success.
 * @returns Mutation result with cloneExercise function
 */
export function useCloneExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.exercises.clone.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.exercises.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error al clonar el ejercicio' })
    },
  })
}
