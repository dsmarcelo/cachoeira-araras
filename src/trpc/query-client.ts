import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

/**
 * Determines if an error should trigger a retry
 * Network errors and 5xx errors should be retried
 */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  // Don't retry if we've already tried 3 times
  if (failureCount >= 3) {
    return false;
  }

  // Retry on network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("timeout")
    ) {
      return true;
    }
  }

  // Retry on 5xx server errors (if error has status code)
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status >= 500 && error.status < 600;
  }

  // Don't retry for other errors (4xx, validation errors, etc.)
  return false;
};

/**
 * Calculates retry delay with exponential backoff
 * Returns delay in milliseconds
 */
const getRetryDelay = (attemptIndex: number): number => {
  // Exponential backoff: 1s, 2s, 4s
  return Math.min(1000 * 2 ** attemptIndex, 4000);
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // Retry configuration with exponential backoff
        retry: shouldRetry,
        retryDelay: getRetryDelay,
        // Refetch on window focus only if data is stale
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect automatically (we'll handle this with our network hook)
        refetchOnReconnect: false,
      },
      mutations: {
        // Retry mutations on network errors
        retry: (failureCount, error) => {
          // Only retry once for network errors
          if (failureCount >= 1) {
            return false;
          }
          return shouldRetry(failureCount, error);
        },
        retryDelay: getRetryDelay,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
