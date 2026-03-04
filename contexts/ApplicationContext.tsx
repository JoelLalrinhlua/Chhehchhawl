/**
 * ApplicationContext.tsx — Task-application management provider.
 *
 * Responsibilities:
 *  - Apply for / withdraw from a task (via TanStack mutations with optimistic updates)
 *  - Accept / reject applicants (poster actions via Supabase RPCs)
 *  - Fetch applicant lists & counts for task posters
 *  - Track the current user's application status per task
 *  - Supabase Realtime subscription auto-invalidates application queries
 *
 * Consumed via the `useApplications()` hook.
 */

import { useApplicantCountsQuery, useMyApplicationsQuery } from '@/hooks/use-application-queries';
import {
    useAcceptApplicantMutation,
    useApplyForTaskMutation,
    useRejectApplicantMutation,
    useWithdrawApplicationMutation,
} from '@/hooks/use-mutations';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────
/** A single applicant's data as returned by the `get_task_applicants` RPC. */
export interface TaskApplicant {
    application_id: string;
    applicant_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
    message: string | null;
    applied_at: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
}

/** The current user's application record (my side). */
export interface MyApplication {
    id: string;
    task_id: string;
    status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
    message: string | null;
    created_at: string;
}

interface ApplicationContextType {
    /** Apply for a task (calls atomic RPC) */
    applyForTask: (
        taskId: string,
        message?: string
    ) => Promise<{ success: boolean; error?: string }>;

    /** Withdraw own application */
    withdrawApplication: (
        taskId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /** Accept an applicant (poster action) */
    acceptApplicant: (
        taskId: string,
        applicantId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /** Reject an applicant permanently (poster action) */
    rejectApplicant: (
        taskId: string,
        applicantId: string
    ) => Promise<{ success: boolean; error?: string }>;

    /** Fetch applicants for a task (poster view) */
    getTaskApplicants: (
        taskId: string
    ) => Promise<TaskApplicant[]>;

    /** Get the current user's application status for a given task */
    getMyApplicationStatus: (
        taskId: string
    ) => Promise<{ status: string | null; application_id?: string }>;

    /** All of current user's applications (cached) */
    myApplications: MyApplication[];

    /** Refresh current user's applications */
    refreshMyApplications: () => Promise<void>;

    /** Applicant counts keyed by task_id */
    applicantCounts: Record<string, number>;

    /** Refresh applicant counts for given task IDs */
    refreshApplicantCounts: (taskIds: string[]) => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextType | null>(null);

/**
 * Provides application actions and cached data to the component tree.
 * Internally wires up TanStack Query + Supabase Realtime for live updates.
 */
export function ApplicationProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();

    // Tracked task IDs for applicant counts
    const [trackedTaskIds, setTrackedTaskIds] = useState<string[]>([]);

    // ── TanStack Query: My Applications ─────────────────────────
    const { data: myApplications = [] } = useMyApplicationsQuery(user?.id, isAuthenticated);

    // ── TanStack Query: Applicant Counts ────────────────────────
    const { data: applicantCounts = {} } = useApplicantCountsQuery(trackedTaskIds, isAuthenticated);

    // ── Mutations via TanStack Query ────────────────────────────
    const applyMutation = useApplyForTaskMutation(user?.id);
    const withdrawMutation = useWithdrawApplicationMutation(user?.id);
    const acceptMutation = useAcceptApplicantMutation(user?.id);
    const rejectMutation = useRejectApplicantMutation(user?.id);

    // ── Refresh helpers (invalidate queries) ────────────────────
    const refreshMyApplications = useCallback(async () => {
        if (user?.id) {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.applications.mine(user.id),
            });
        }
    }, [user?.id]);

    const refreshApplicantCounts = useCallback(async (taskIds: string[]) => {
        if (!taskIds.length) return;
        setTrackedTaskIds(taskIds);
        await queryClient.invalidateQueries({
            queryKey: ['applications', 'counts'],
        });
    }, []);

    // ── Apply for a task ────────────────────────────────────────
    const applyForTask = useCallback(
        async (taskId: string, message?: string) => {
            if (!user) return { success: false, error: 'Not authenticated' };

            try {
                await applyMutation.mutateAsync({ taskId, message });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message || 'Failed to apply' };
            }
        },
        [user, applyMutation]
    );

    // ── Withdraw application ────────────────────────────────────
    const withdrawApplication = useCallback(
        async (taskId: string) => {
            if (!user) return { success: false, error: 'Not authenticated' };

            try {
                await withdrawMutation.mutateAsync({ taskId });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message || 'Failed to withdraw' };
            }
        },
        [user, withdrawMutation]
    );

    // ── Accept applicant ────────────────────────────────────────
    const acceptApplicant = useCallback(
        async (taskId: string, applicantId: string) => {
            if (!user) return { success: false, error: 'Not authenticated' };

            try {
                await acceptMutation.mutateAsync({ taskId, applicantId });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message || 'Failed to accept' };
            }
        },
        [user, acceptMutation]
    );

    // ── Reject applicant ────────────────────────────────────────
    const rejectApplicant = useCallback(
        async (taskId: string, applicantId: string) => {
            if (!user) return { success: false, error: 'Not authenticated' };

            try {
                await rejectMutation.mutateAsync({ taskId, applicantId });
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message || 'Failed to reject' };
            }
        },
        [user, rejectMutation]
    );

    // ── Get task applicants (imperative, used by sheets) ────────
    const getTaskApplicants = useCallback(async (taskId: string) => {
        const { data, error } = await supabase.rpc('get_task_applicants', {
            p_task_id: taskId,
        });

        if (error) {
            if (__DEV__) console.error('Error fetching applicants:', error.message);
            return [];
        }
        return (data ?? []) as TaskApplicant[];
    }, []);

    // ── Get my application status (imperative) ──────────────────
    const getMyApplicationStatus = useCallback(
        async (taskId: string) => {
            if (!user) return { status: null };

            const { data, error } = await supabase.rpc('get_my_application_status', {
                p_task_id: taskId,
                p_user_id: user.id,
            });

            if (error) return { status: null };
            return data as { status: string | null; application_id?: string };
        },
        [user]
    );

    // ── Realtime subscription for task_applications ─────────────
    useEffect(() => {
        if (!isAuthenticated) return;

        const channel = supabase
            .channel('public:task_applications')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'task_applications' },
                () => {
                    // Invalidate application-related queries
                    if (user?.id) {
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.applications.mine(user.id),
                        });
                    }
                    queryClient.invalidateQueries({
                        queryKey: ['applications', 'counts'],
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isAuthenticated, user?.id]);

    const value = useMemo(
        () => ({
            applyForTask,
            withdrawApplication,
            acceptApplicant,
            rejectApplicant,
            getTaskApplicants,
            getMyApplicationStatus,
            myApplications,
            refreshMyApplications,
            applicantCounts,
            refreshApplicantCounts,
        }),
        [
            applyForTask,
            withdrawApplication,
            acceptApplicant,
            rejectApplicant,
            getTaskApplicants,
            getMyApplicationStatus,
            myApplications,
            refreshMyApplications,
            applicantCounts,
            refreshApplicantCounts,
        ]
    );

    return (
        <ApplicationContext.Provider value={value}>
            {children}
        </ApplicationContext.Provider>
    );
}

/** Convenience hook to consume the ApplicationContext. Throws if used outside ApplicationProvider. */
export function useApplications() {
    const context = useContext(ApplicationContext);
    if (!context) {
        throw new Error('useApplications must be used within an ApplicationProvider');
    }
    return context;
}
