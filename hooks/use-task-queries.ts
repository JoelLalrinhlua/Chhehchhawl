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

import type { MyApplication } from '@/contexts/ApplicationContext';
import type { Task } from '@/contexts/TaskContext';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Fetch all tasks (task feed) from Supabase.
 * Joins the `profiles` table via the foreign key to get the poster's username.
 */
const MAX_APPLICANTS = 15;

async function fetchTaskFeed(): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_created_by_fkey(username)')
        .eq('status', 'open')
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
export { MAX_APPLICANTS };

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
                    ['assigned', 'in-progress', 'completed', 'pending_confirmation'].includes(t.status)
            ) ?? [],
        [feedQuery.data, userId]
    );

    return {
        ...feedQuery,
        data,
    };
}

/** A task enriched with the user's application status. */
export type AppliedTask = Task & {
    applicationStatus: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
};

/**
 * Hook to get tasks the user has applied for but is NOT assigned to.
 * Cross-references user's applications with the task feed.
 * Only includes pending/rejected applications (accepted ones show as assigned tasks).
 */
export function useMyAppliedTasksQuery(
    isAuthenticated: boolean,
    userId: string | undefined,
    myApplications: MyApplication[]
) {
    const feedQuery = useTaskFeedQuery(isAuthenticated);

    const data = useMemo(() => {
        if (!feedQuery.data || !userId) return [];

        // Build a map of taskId → application status
        const appMap = new Map<string, MyApplication['status']>();
        for (const app of myApplications) {
            appMap.set(app.task_id, app.status);
        }

        const result: AppliedTask[] = [];
        for (const task of feedQuery.data) {
            const status = appMap.get(task.id);
            if (!status) continue;
            // Skip tasks already assigned to us (those show in useMyTasksQuery)
            if (task.assigned_to === userId) continue;
            // Only show pending and rejected (withdrawn = user removed it)
            if (status !== 'pending' && status !== 'rejected') continue;

            result.push({ ...task, applicationStatus: status });
        }

        return result;
    }, [feedQuery.data, userId, myApplications]);

    return {
        ...feedQuery,
        data,
    };
}
