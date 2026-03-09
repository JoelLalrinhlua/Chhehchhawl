/**
 * TaskContext.tsx — Task feed & CRUD provider.
 *
 * Responsibilities:
 *  - Fetches the global task feed via TanStack Query (`useTaskFeedQuery`)
 *  - Provides `addTask`, `updateTask`, `deleteTask` wrappers around mutations
 *  - Maintains a Supabase Realtime subscription that auto-invalidates the feed
 *    whenever any row in the `tasks` table changes
 *  - Exposes helper getters: `getMyPosts` (tasks I created) and `getMyTasks`
 *    (tasks assigned to me)
 *
 * Consumed via the `useTasks()` hook.
 */

import { useCreateTaskMutation, useDeleteTaskMutation, useUpdateTaskMutation } from '@/hooks/use-mutations';
import { useTaskFeedQuery } from '@/hooks/use-task-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';

/** Shape of a task row from the `tasks` table, plus joined/virtual UI fields. */
export interface Task {
    id: string;
    created_by: string;
    title: string;
    description: string | null;
    budget: number;
    location: string | null;
    locality: string | null;
    categories: string[];
    urgency: 'low' | 'mid' | 'urgent' | null;
    negotiable: boolean;
    extra_description: string | null;
    media_urls: string[] | null;
    latitude: number | null;
    longitude: number | null;
    assigned_to: string | null;
    status: 'open' | 'assigned' | 'in-progress' | 'pending_confirmation' | 'completed' | 'cancelled';
    tasker_completed: boolean;
    poster_confirmed: boolean;
    created_at: string;
    updated_at: string;
    // Joined fields (populated by queries)
    applicant_count?: number;
    poster_name?: string;
    // Virtual fields for UI
    distance?: string;
    timeAgo?: string;
    applicants?: number;
}

interface TaskContextType {
    tasks: Task[];
    loading: boolean;
    refreshTasks: () => Promise<void>;
    addTask: (task: Pick<Task, 'title' | 'description' | 'budget' | 'location' | 'locality' | 'categories' | 'urgency' | 'negotiable' | 'extra_description' | 'media_urls' | 'latitude' | 'longitude'>) => Promise<{ error: string | null }>;
    updateTask: (id: string, data: Partial<Task>) => Promise<{ error: string | null }>;
    deleteTask: (id: string) => Promise<{ error: string | null }>;
    getMyPosts: (userId: string) => Task[];
    getMyTasks: (userId: string) => Task[];
}

const TaskContext = createContext<TaskContextType>({
    tasks: [],
    loading: false,
    refreshTasks: async () => {},
    addTask: async () => ({ error: null }),
    updateTask: async () => ({ error: null }),
    deleteTask: async () => ({ error: null }),
    getMyPosts: () => [],
    getMyTasks: () => [],
});

/**
 * Provides the task feed and CRUD operations to the component tree.
 * Subscribes to Supabase Realtime for live task updates.
 */
export function TaskProvider({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated } = useAuth();

    // Use TanStack Query for task feed with caching & background refetch
    const { data: tasks = [], isLoading: loading } = useTaskFeedQuery(isAuthenticated);

    // Mutations via TanStack Query
    const createTaskMutation = useCreateTaskMutation(user?.id);
    const updateTaskMutation = useUpdateTaskMutation();
    const deleteTaskMutation = useDeleteTaskMutation();

    // Refresh tasks by invalidating the query
    const refreshTasks = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.feed() });
    }, []);

    // ── Realtime subscription ──
    useEffect(() => {
        if (!isAuthenticated) return;

        const channel = supabase
            .channel('public:tasks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                // Invalidate query to trigger refetch
                queryClient.invalidateQueries({ queryKey: queryKeys.tasks.feed() });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isAuthenticated]);

    // ── Create task ──
    const addTask = useCallback(
        async (task: Pick<Task, 'title' | 'description' | 'budget' | 'location' | 'locality' | 'categories' | 'urgency' | 'negotiable' | 'extra_description' | 'media_urls' | 'latitude' | 'longitude'>) => {
            if (!user) return { error: 'Not authenticated' };

            try {
                await createTaskMutation.mutateAsync(task);
                return { error: null };
            } catch (err: any) {
                return { error: err.message || 'Failed to create task' };
            }
        },
        [user, createTaskMutation]
    );

    // ── Update task ──
    const updateTask = useCallback(
        async (id: string, data: Partial<Task>) => {
            try {
                await updateTaskMutation.mutateAsync({ taskId: id, data });
                return { error: null };
            } catch (err: any) {
                return { error: err.message || 'Failed to update task' };
            }
        },
        [updateTaskMutation]
    );

    // ── Delete task ──
    const deleteTask = useCallback(
        async (id: string) => {
            try {
                await deleteTaskMutation.mutateAsync(id);
                return { error: null };
            } catch (err: any) {
                return { error: err.message || 'Failed to delete task' };
            }
        },
        [deleteTaskMutation]
    );

    // ── My posts (tasks I created) ──
    const getMyPosts = useCallback(
        (userId: string) => tasks.filter((t) => t.created_by === userId),
        [tasks]
    );

    // ── My tasks (tasks assigned to me) ──
    const getMyTasks = useCallback(
        (userId: string) =>
            tasks.filter(
                (t) =>
                    t.assigned_to === userId &&
                    ['assigned', 'in-progress', 'completed', 'pending_confirmation'].includes(t.status)
            ),
        [tasks]
    );

    const value = useMemo(
        () => ({ tasks, loading, refreshTasks, addTask, updateTask, deleteTask, getMyPosts, getMyTasks }),
        [tasks, loading, refreshTasks, addTask, updateTask, deleteTask, getMyPosts, getMyTasks]
    );

    return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

/** Convenience hook to consume the TaskContext. Throws if used outside TaskProvider. */
export function useTasks() {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
}
