/**
 * use-task-queries.ts — TanStack Query hooks for the task feed.
 *
 * `useTaskFeedQuery`  — fetches the full task list with poster usernames.
 * `useMyPostsQuery`   — derived subset: tasks created by the current user.
 * `useMyTasksQuery`   — derived subset: tasks assigned to the current user.
 *
 * All three hooks share the same underlying network request; the derived
 * hooks filter the cached data in-memory with `useMemo`.
 */

import type { Task } from '@/contexts/TaskContext';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Fetch all tasks (task feed) from Supabase.
 * Joins the `profiles` table via the foreign key to get the poster's username.
 */
async function fetchTaskFeed(): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_created_by_fkey(username)')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? []).map((t: any) => ({
        ...t,
        poster_name: t.profiles?.username ?? 'Anonymous',
    }));
}

/**
 * Hook to fetch the full task feed.
 * Enabled only when the user is authenticated.
 */
export function useTaskFeedQuery(isAuthenticated: boolean) {
    return useQuery({
        queryKey: queryKeys.tasks.feed(),
        queryFn: fetchTaskFeed,
        enabled: isAuthenticated,
        staleTime: 15 * 1000, // Tasks are fresh for 15 seconds
    });
}

/**
 * Hook to get the current user's posted tasks (derived from the task feed).
 */
export function useMyPostsQuery(isAuthenticated: boolean, userId: string | undefined) {
    const feedQuery = useTaskFeedQuery(isAuthenticated);

    const data = useMemo(
        () => feedQuery.data?.filter((t) => t.created_by === userId) ?? [],
        [feedQuery.data, userId]
    );

    return {
        ...feedQuery,
        data,
    };
}

/**
 * Hook to get tasks assigned to the current user (derived from the task feed).
 */
export function useMyTasksQuery(isAuthenticated: boolean, userId: string | undefined) {
    const feedQuery = useTaskFeedQuery(isAuthenticated);

    const data = useMemo(
        () =>
            feedQuery.data?.filter(
                (t) =>
                    t.assigned_to === userId &&
                    ['assigned', 'in-progress', 'completed'].includes(t.status)
            ) ?? [],
        [feedQuery.data, userId]
    );

    return {
        ...feedQuery,
        data,
    };
}
