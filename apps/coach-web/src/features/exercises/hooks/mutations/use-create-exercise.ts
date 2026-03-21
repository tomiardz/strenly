import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/api-client'
import { handleMutationError } from '@/lib/api-errors'

/**
 * Hook to create a new exercise.
 * Invalidates exercise list cache on success.
 * @returns Mutation result with createExercise function
 */
export function useCreateExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.exercises.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.exercises.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error al crear el ejercicio' })
    },
  })
}
