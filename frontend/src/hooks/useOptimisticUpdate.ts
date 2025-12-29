/**
 * Hook for optimistic updates
 * Updates UI immediately, then syncs with server
 */

import { useState, useCallback, useRef } from "react";

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: unknown, rollback: () => void) => void;
  rollbackOnError?: boolean;
}

/**
 * Hook for optimistic updates
 * @param initialData - Initial data state
 * @param updateFn - Function to perform the actual update
 * @param options - Configuration options
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
) {
  const { onSuccess, onError, rollbackOnError = true } = options;
  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const previousDataRef = useRef<T>(initialData);

  const update = useCallback(
    async (optimisticData: T) => {
      // Store previous data for rollback
      previousDataRef.current = data;

      // Optimistically update UI
      setData(optimisticData);
      setIsUpdating(true);
      setError(null);

      try {
        // Perform actual update
        const result = await updateFn(optimisticData);
        setData(result);
        setIsUpdating(false);
        onSuccess?.(result);
        return result;
      } catch (err) {
        setError(err);
        setIsUpdating(false);

        // Rollback on error
        if (rollbackOnError) {
          setData(previousDataRef.current);
        }

        const rollback = () => {
          setData(previousDataRef.current);
        };

        onError?.(err, rollback);
        throw err;
      }
    },
    [data, updateFn, onSuccess, onError, rollbackOnError]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsUpdating(false);
  }, [initialData]);

  return {
    data,
    isUpdating,
    error,
    update,
    reset,
  };
}

