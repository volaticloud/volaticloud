import { useState, useCallback } from 'react';
import { ApolloError, FetchResult } from '@apollo/client';

interface MutationHandlerState {
  loading: boolean;
  error: string | null;
}

interface MutationHandlerReturn<TData, TVariables> {
  /** Current mutation state */
  state: MutationHandlerState;
  /** Execute the mutation with error handling */
  execute: (variables: TVariables) => Promise<TData | null>;
  /** Clear any error */
  clearError: () => void;
  /** Check if there's an error */
  hasError: boolean;
}

type MutationFn<TData, TVariables> = (options: {
  variables: TVariables;
}) => Promise<FetchResult<TData>>;

type ResultExtractor<TData, TResult> = (data: TData) => TResult | null | undefined;

interface UseMutationHandlerOptions<TData, TResult> {
  /** Function to extract the result from mutation data (e.g., (data) => data.deleteBot) */
  getResult: ResultExtractor<TData, TResult>;
  /** Default error message if none provided */
  errorMessage?: string;
  /** Callback on success */
  onSuccess?: (result: TResult) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * Hook to wrap Apollo mutations with consistent error handling.
 *
 * @example
 * const [deleteBotMutation, { loading: mutationLoading }] = useDeleteBotMutation();
 *
 * const deleteHandler = useMutationHandler(deleteBotMutation, {
 *   getResult: (data) => data.deleteBot,
 *   errorMessage: 'Failed to delete bot',
 *   onSuccess: () => {
 *     onClose();
 *     refetch();
 *   },
 * });
 *
 * // In handler
 * await deleteHandler.execute({ id: bot.id });
 *
 * // In JSX
 * {deleteHandler.hasError && <Alert severity="error">{deleteHandler.state.error}</Alert>}
 * <Button disabled={deleteHandler.state.loading}>Delete</Button>
 */
export function useMutationHandler<TData, TVariables, TResult>(
  mutation: MutationFn<TData, TVariables>,
  options: UseMutationHandlerOptions<TData, TResult>
): MutationHandlerReturn<TResult, TVariables> {
  const { getResult, errorMessage = 'Operation failed', onSuccess, onError } = options;

  const [state, setState] = useState<MutationHandlerState>({
    loading: false,
    error: null,
  });

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const execute = useCallback(
    async (variables: TVariables): Promise<TResult | null> => {
      setState({ loading: true, error: null });

      try {
        const result = await mutation({ variables });

        // Check for GraphQL errors
        if (result.errors?.length) {
          const error = result.errors[0].message || errorMessage;
          setState({ loading: false, error });
          onError?.(error);
          return null;
        }

        // Check for missing data
        if (!result.data) {
          setState({ loading: false, error: errorMessage });
          onError?.(errorMessage);
          return null;
        }

        // Extract the result using the provided function
        const extractedResult = getResult(result.data);
        if (extractedResult === null || extractedResult === undefined) {
          setState({ loading: false, error: errorMessage });
          onError?.(errorMessage);
          return null;
        }

        setState({ loading: false, error: null });
        onSuccess?.(extractedResult);
        return extractedResult;
      } catch (err) {
        // Handle network errors
        const error =
          err instanceof ApolloError
            ? err.message
            : err instanceof Error
              ? err.message
              : errorMessage;

        console.error('Mutation error:', err);
        setState({ loading: false, error });
        onError?.(error);
        return null;
      }
    },
    [mutation, getResult, errorMessage, onSuccess, onError]
  );

  return {
    state,
    execute,
    clearError,
    hasError: state.error !== null,
  };
}