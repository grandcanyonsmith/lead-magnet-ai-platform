/**
 * Generic mutation hook wrapper around React Query
 * Provides consistent mutation patterns across the app
 */

import {
  useMutation as useReactMutation,
  UseMutationOptions as ReactUseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "react-hot-toast";

export interface UseMutationOptions<
  TData,
  TError = Error,
  TVariables = void,
> extends Omit<
  ReactUseMutationOptions<TData, TError, TVariables>,
  "mutationFn"
> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables) => void | Promise<void>;
  showSuccessToast?: boolean | string;
  showErrorToast?: boolean | string;
  invalidateQueries?: (readonly unknown[])[];
}

/**
 * Generic mutation hook with built-in toast notifications
 * @param mutationFn - Function that performs the mutation
 * @param options - Additional React Query options
 */
export function useMutation<TData = unknown, TError = Error, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables>,
): UseMutationResult<TData, TError, TVariables> {
  const {
    showSuccessToast,
    showErrorToast,
    invalidateQueries,
    onSuccess,
    onError,
    ...mutationOptions
  } = options || {};

  return useReactMutation<TData, TError, TVariables>({
    mutationFn,
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Show success toast if enabled
      if (showSuccessToast) {
        const message =
          typeof showSuccessToast === "string"
            ? showSuccessToast
            : "Operation completed successfully";
        toast.success(message);
      }

      // Invalidate related queries if specified
      if (invalidateQueries) {
        const { queryClient } = await import("@/lib/react-query");
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey: [...queryKey] });
        });
      }

      // Call custom onSuccess handler
      if (onSuccess) {
        await onSuccess(data, variables);
      }
    },
    onError: async (error, variables, context) => {
      // Show error toast if enabled
      if (showErrorToast !== false) {
        const message =
          typeof showErrorToast === "string"
            ? showErrorToast
            : error instanceof Error
              ? error.message
              : "An error occurred";
        toast.error(message);
      }

      // Call custom onError handler
      if (onError) {
        await onError(error, variables);
      }
    },
  });
}
