/**
 * use-profile-queries.ts — TanStack Query hooks for user profiles.
 *
 * `useProfileQuery`   — fetches the current user's profile row.
 * `useUsernameCheck`  — debounced query to check if a username is available.
 */

import type { Profile } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetch a single user's profile from the `profiles` table.
 */
async function fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }
    return (data as Profile) ?? null;
}

/**
 * Hook to fetch user profile data via TanStack Query.
 * Enabled only when a userId is provided.
 */
export function useProfileQuery(userId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.auth.profile(userId ?? ''),
        queryFn: () => fetchProfile(userId!),
        enabled: !!userId,
        staleTime: 60 * 1000, // Profile is fresh for 1 minute
    });
}

/**
 * Check if a username is available (debounced via query).
 * Returns true if available, false if taken.
 */
async function checkUsernameAvailability(
    username: string,
    currentUserId: string
): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .neq('id', currentUserId)
        .maybeSingle();

    return !data; // true = available
}

/**
 * Hook for debounced username validation with caching.
 * Prevents duplicate API calls for the same username.
 */
export function useUsernameCheck(
    username: string,
    currentUserId: string | undefined
) {
    return useQuery({
        queryKey: queryKeys.auth.usernameCheck(username.toLowerCase()),
        queryFn: () => checkUsernameAvailability(username, currentUserId!),
        enabled: !!currentUserId && username.length >= 3,
        staleTime: 5 * 60 * 1000, // Cache username check for 5 minutes
        gcTime: 10 * 60 * 1000,
        retry: 1,
    });
}
