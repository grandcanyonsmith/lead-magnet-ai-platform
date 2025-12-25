/**
 * Generic query hook wrapper around React Query
 * Provides consistent data fetching patterns across the app
 */

import {
  useQuery as useReactQuery,
  UseQueryOptions as ReactUseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

export interface UseQueryOptions<TData, TError = Error> extends Omit<
  ReactUseQueryOptions<TData, TError>,
  "queryKey" | "queryFn"
> {
  enabled?: boolean;
  refetchInterval?:
    | number
    | false
    | ((query: { state: { data?: TData } }) => number | false);
  refetchOnWindowFocus?: boolean;
}

/**
 * Generic query hook
 * @param queryKey - Unique key for the query (array format)
 * @param queryFn - Function that returns a promise
 * @param options - Additional React Query options
 */
export function useQuery<TData = unknown, TError = Error>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<TData>,
  options?: UseQueryOptions<TData, TError>,
): UseQueryResult<TData, TError> {
  return useReactQuery<TData, TError>({
    queryKey,
    queryFn,
    ...options,
  });
}
