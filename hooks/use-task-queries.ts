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
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Fetch all tasks (task feed) from Supabase.
 * Joins the `profiles` table via the foreign key to get the poster's username.
 */
const MAX_APPLICANTS = 15;
export const TASK_PAGE_SIZE = 20;

/** Bounded feed used by TaskContext — capped at 100 open tasks. */
async function fetchTaskFeed(): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_created_by_fkey(username)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) throw new Error(error.message);

    return (data ?? []).map((t: any) => ({
        ...t,
        poster_name: t.profiles?.username ?? 'Anonymous',
    }));
}

/** One page of the task feed for the infinite-scroll tasks screen. */
async function fetchTaskFeedPage({ pageParam }: { pageParam: number }): Promise<Task[]> {
    const from = pageParam * TASK_PAGE_SIZE;
    const to = from + TASK_PAGE_SIZE - 1;

    const { data, error } = await supabase
        .from('tasks')
        .select('*, profiles!tasks_created_by_fkey(username)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw new Error(error.message);

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

/**
 * Infinite-scroll version of the task feed for the tasks screen.
 * Each page fetches TASK_PAGE_SIZE tasks; fetch stops when a page returns fewer rows.
 */
export function useInfiniteTaskFeedQuery(isAuthenticated: boolean) {
    return useInfiniteQuery({
        queryKey: queryKeys.tasks.infiniteFeed(),
        queryFn: fetchTaskFeedPage,
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length < TASK_PAGE_SIZE ? undefined : allPages.length,
        enabled: isAuthenticated,
        staleTime: 15 * 1000,
    });
}

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

// ── User Stats Query ──────────────────────────────────────────────────────────

export type UserStats = {
    // ── As Tasker ──
    tasksPosted: number;
    tasksCompleted: number;
    tasksActive: number;
    totalEarned: number;
    applicationsTotal: number;
    applicationsAccepted: number;
    // ── As Poster ──
    postsTotal: number;
    postsOpen: number;
    postsInProgress: number;
    postsCompleted: number;
    totalSpent: number;
    helpersHired: number;
};

async function fetchUserStats(userId: string): Promise<UserStats> {
    const [
        completedRes,   // tasks I completed as tasker
        activeRes,      // tasks actively assigned to me
        appsRes,        // all my applications
        postsAllRes,    // all tasks I've ever posted
        postsOpenRes,   // my currently open posts
        postsActiveRes, // my posts with an active tasker
        postsSpentRes,  // my posts that are fully done (money paid)
    ] = await Promise.all([
        // Tasker: tasks assigned to me that are in a done state
        supabase
            .from('tasks')
            .select('budget')
            .eq('assigned_to', userId)
            .in('status', ['completed', 'payment_pending', 'payment_sent', 'pending_confirmation']),

        // Tasker: tasks actively assigned / in-progress
        supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_to', userId)
            .in('status', ['assigned', 'in-progress']),

        // Tasker: all applications submitted by me
        supabase
            .from('task_applications')
            .select('status')
            .eq('applicant_id', userId),

        // Poster: total tasks I've ever created (all statuses)
        supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', userId),

        // Poster: currently open posts (seeking applicants)
        supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', userId)
            .eq('status', 'open'),

        // Poster: posts with an assigned/in-progress tasker
        supabase
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', userId)
            .in('status', ['assigned', 'in-progress', 'pending_confirmation', 'payment_pending', 'payment_sent']),

        // Poster: completed posts + money spent
        supabase
            .from('tasks')
            .select('budget')
            .eq('created_by', userId)
            .in('status', ['payment_sent', 'completed']),
    ]);

    // ── Tasker calcs ──
    const completedTasks = completedRes.data ?? [];
    const tasksCompleted = completedTasks.length;
    const totalEarned = completedTasks.reduce((sum, t) => sum + (t.budget ?? 0), 0);
    const tasksActive = activeRes.count ?? 0;
    const apps = appsRes.data ?? [];
    const applicationsTotal = apps.length;
    const applicationsAccepted = apps.filter(
        (a) => a.status === 'accepted' || a.status === 'assigned'
    ).length;

    // ── Poster calcs ──
    const postsTotal = postsAllRes.count ?? 0;
    const postsOpen = postsOpenRes.count ?? 0;
    const postsInProgress = postsActiveRes.count ?? 0;
    const completedPosts = postsSpentRes.data ?? [];
    const postsCompleted = completedPosts.length;
    const totalSpent = completedPosts.reduce((sum, t) => sum + (t.budget ?? 0), 0);
    // helpersHired = distinct people who've ever been assigned my tasks
    const helpersHired = postsCompleted + postsInProgress;

    return {
        tasksPosted: postsTotal, // keep for backward compat
        tasksCompleted,
        tasksActive,
        totalEarned,
        applicationsTotal,
        applicationsAccepted,
        postsTotal,
        postsOpen,
        postsInProgress,
        postsCompleted,
        totalSpent,
        helpersHired,
    };
}


export function useUserStatsQuery(userId: string | undefined, isAuthenticated: boolean) {
    return useQuery({
        queryKey: queryKeys.tasks.userStats(userId ?? ''),
        queryFn: () => fetchUserStats(userId!),
        enabled: !!userId && isAuthenticated,
        staleTime: 30 * 1000,
    });
}
