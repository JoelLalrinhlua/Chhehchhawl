/**
 * use-application-queries.ts — TanStack Query hooks for task applications.
 *
 * `useMyApplicationsQuery`      — all applications submitted by the current user.
 * `useTaskApplicantsQuery`      — applicant list for a specific task (poster view).
 * `useMyApplicationStatusQuery` — status of the current user's application on a task.
 * `useApplicantCountsQuery`     — applicant counts for multiple tasks at once.
 */

import type { MyApplication, TaskApplicant } from '@/contexts/ApplicationContext';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetch all applications made by the current user from `task_applications`.
 */
async function fetchMyApplications(userId: string): Promise<MyApplication[]> {
    const { data, error } = await supabase
        .from('task_applications')
        .select('id, task_id, status, message, created_at')
        .eq('applicant_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }
    return (data ?? []) as MyApplication[];
}

/**
 * Hook to fetch all of the current user's applications.
 */
export function useMyApplicationsQuery(userId: string | undefined, isAuthenticated: boolean) {
    return useQuery({
        queryKey: queryKeys.applications.mine(userId ?? ''),
        queryFn: () => fetchMyApplications(userId!),
        enabled: !!userId && isAuthenticated,
        staleTime: 15 * 1000,
    });
}

/**
 * Fetch applicants for a specific task.
 */
async function fetchTaskApplicants(taskId: string): Promise<TaskApplicant[]> {
    const { data, error } = await supabase.rpc('get_task_applicants', {
        p_task_id: taskId,
    });

    if (error) {
        throw new Error(error.message);
    }
    return (data ?? []) as TaskApplicant[];
}

/**
 * Hook to fetch applicants for a specific task.
 */
export function useTaskApplicantsQuery(taskId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.applications.forTask(taskId ?? ''),
        queryFn: () => fetchTaskApplicants(taskId!),
        enabled: !!taskId && enabled,
        staleTime: 10 * 1000,
    });
}

/**
 * Fetch the current user's application status for a task.
 */
async function fetchMyApplicationStatus(
    taskId: string,
    userId: string
): Promise<{ status: string | null; application_id?: string }> {
    const { data, error } = await supabase.rpc('get_my_application_status', {
        p_task_id: taskId,
        p_user_id: userId,
    });

    if (error) {
        return { status: null };
    }
    return data as { status: string | null; application_id?: string };
}

/**
 * Hook to fetch the current user's application status for a task.
 */
export function useMyApplicationStatusQuery(
    taskId: string | undefined,
    userId: string | undefined,
    enabled: boolean = true
) {
    return useQuery({
        queryKey: queryKeys.applications.myStatus(taskId ?? '', userId ?? ''),
        queryFn: () => fetchMyApplicationStatus(taskId!, userId!),
        enabled: !!taskId && !!userId && enabled,
        staleTime: 10 * 1000,
    });
}

/**
 * Fetch applicant counts for given task IDs.
 */
async function fetchApplicantCounts(
    taskIds: string[]
): Promise<Record<string, number>> {
    if (!taskIds.length) return {};

    const { data, error } = await supabase.rpc('get_task_applicant_counts', {
        task_ids: taskIds,
    });

    if (error) {
        throw new Error(error.message);
    }

    const map: Record<string, number> = {};
    (data as { task_id: string; applicant_count: number }[]).forEach((r) => {
        map[r.task_id] = r.applicant_count;
    });
    return map;
}

/**
 * Hook to fetch applicant counts for given task IDs.
 */
export function useApplicantCountsQuery(taskIds: string[], enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.applications.counts(taskIds),
        queryFn: () => fetchApplicantCounts(taskIds),
        enabled: enabled && taskIds.length > 0,
        staleTime: 15 * 1000,
    });
}
