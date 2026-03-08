/**
 * query-client.ts — Configures the shared TanStack QueryClient.
 *
 * Default behaviour:
 *  • Retry failed queries up to 2× with exponential back-off.
 *  • Data is considered fresh for 30 s; garbage-collected after 5 min.
 *  • Queries re-fetch when the app returns to the foreground (focusManager).
 *
 * Used by `<QueryClientProvider>` in the root layout.
 */

import { focusManager, QueryClient } from '@tanstack/react-query';
import type { AppStateStatus } from 'react-native';
import { AppState, Platform } from 'react-native';

/** Notify TanStack Query when the app enters / leaves the foreground. */
function onAppStateChange(status: AppStateStatus) {
    if (Platform.OS !== 'web') {
        // Refetch active queries when app comes to foreground
        focusManager.setFocused(status === 'active');
    }
}

// Wire up app-state based focus management
const subscription = AppState.addEventListener('change', onAppStateChange);

/** Singleton QueryClient — shared across the entire app. */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Retry failed requests up to 2 times with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // Refetch on window focus (app foregrounded)
            refetchOnWindowFocus: true,
            // Keep data fresh for 30 seconds
            staleTime: 30 * 1000,
            // Cache data for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Refetch when reconnecting
            refetchOnReconnect: true,
        },
        mutations: {
            retry: 1,
        },
    },
});
