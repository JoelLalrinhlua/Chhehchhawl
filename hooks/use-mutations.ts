/**
 * use-mutations.ts — All TanStack Query mutation hooks.
 *
 * Organised into three sections:
 *  1. **Profile** — update the user's profile row.
 *  2. **Tasks**   — create / update / delete tasks.
 *  3. **Applications** — apply, withdraw, accept, reject applicants.
 *
 * Each mutation performs a Supabase operation, then invalidates the relevant
 * query keys so the UI stays in sync. Application mutations also include
 * optimistic updates for snappy UX.
 */

import type { Profile } from '@/contexts/AuthContext';
import type { Task } from '@/contexts/TaskContext';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useMutation } from '@tanstack/react-query';

// ── Profile Mutations ──────────────────────────────────────────

type UpdateProfileInput = {
    userId: string;
    data: Partial<Profile>;
};

/** Upsert the user's profile row in Supabase (insert-or-update). */
async function updateProfileFn({ userId, data }: UpdateProfileInput) {
    const updates = {
        ...data,
        id: userId,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) throw new Error(error.message);
    return updates;
}

/**
 * Mutation hook for updating user profile.
 * Invalidates the profile query after success.
 */
/** Mutation hook to update the current user's profile. Invalidates the profile query on success. */
export function useUpdateProfileMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: (data: Partial<Profile>) =>
            updateProfileFn({ userId: userId!, data }),
        onSuccess: () => {
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.auth.profile(userId),
                });
            }
        },
    });
}

// ── Task Mutations ─────────────────────────────────────────────

type CreateTaskInput = Pick<
    Task,
    | 'title'
    | 'description'
    | 'budget'
    | 'location'
    | 'locality'
    | 'categories'
    | 'urgency'
    | 'negotiable'
    | 'extra_description'
    | 'media_urls'
    | 'latitude'
    | 'longitude'
>;

/** Insert a new task row into Supabase, owned by `userId`. */
async function createTaskFn(userId: string, task: CreateTaskInput) {
    const { error } = await supabase.from('tasks').insert([
        {
            created_by: userId,
            title: task.title,
            description: task.description,
            budget: task.budget,
            location: task.location,
            locality: task.locality,
            categories: task.categories,
            urgency: task.urgency,
            negotiable: task.negotiable,
            extra_description: task.extra_description,
            media_urls: task.media_urls,
            latitude: task.latitude,
            longitude: task.longitude,
        },
    ]);

    if (error) throw new Error(error.message);
}

/**
 * Mutation hook for creating a new task.
 * Invalidates the task feed after success.
 */
export function useCreateTaskMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: (task: CreateTaskInput) => createTaskFn(userId!, task),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

type UpdateTaskInput = {
    taskId: string;
    data: Partial<Task>;
};

/** Partially update an existing task row. */
async function updateTaskFn({ taskId, data }: UpdateTaskInput) {
    const { error } = await supabase.from('tasks').update(data).eq('id', taskId);
    if (error) throw new Error(error.message);
}

/**
 * Mutation hook for updating a task (e.g. status change).
 * Invalidates the task feed after success.
 */
export function useUpdateTaskMutation() {
    return useMutation({
        mutationFn: ({ taskId, data }: UpdateTaskInput) =>
            updateTaskFn({ taskId, data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

/** Delete a task by ID. */
async function deleteTaskFn(taskId: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw new Error(error.message);
}

/**
 * Mutation hook for deleting a task.
 */
/** Mutation hook to delete a task. Invalidates the task feed on success. */
export function useDeleteTaskMutation() {
    return useMutation({
        mutationFn: deleteTaskFn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

// ── Application Mutations ──────────────────────────────────────

type ApplyForTaskInput = {
    taskId: string;
    userId: string;
    message?: string;
};

/** Call the `apply_for_task` RPC to submit an application. */
async function applyForTaskFn({ taskId, userId, message }: ApplyForTaskInput) {
    const { data, error } = await supabase.rpc('apply_for_task', {
        p_task_id: taskId,
        p_applicant_id: userId,
        p_message: message ?? null,
    });

    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to apply');
    return result;
}

/**
 * Mutation hook for applying to a task.
 * Includes optimistic update for the application status.
 */
/**
 * Mutation hook to apply for a task.
 * Performs an optimistic update — immediately adds a “pending” entry
 * to the `myApplications` cache, then rolls back on error.
 */
export function useApplyForTaskMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId, message }: { taskId: string; message?: string }) =>
            applyForTaskFn({ taskId, userId: userId!, message }),
        // Optimistic update: immediately show "pending" status
        onMutate: async ({ taskId }) => {
            if (!userId) return;

            // Cancel outgoing refetches
            await queryClient.cancelQueries({
                queryKey: queryKeys.applications.myStatus(taskId, userId),
            });

            // Snapshot previous value
            const previousStatus = queryClient.getQueryData(
                queryKeys.applications.myStatus(taskId, userId)
            );

            // Optimistically update status to pending
            queryClient.setQueryData(
                queryKeys.applications.myStatus(taskId, userId),
                { status: 'pending' }
            );

            return { previousStatus, taskId };
        },
        onError: (_err, _vars, context) => {
            // Rollback on error
            if (context?.previousStatus && userId) {
                queryClient.setQueryData(
                    queryKeys.applications.myStatus(context.taskId, userId),
                    context.previousStatus
                );
            }
        },
        onSettled: (_data, _error, { taskId }) => {
            // Invalidate related queries
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.applications.mine(userId),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.applications.myStatus(taskId, userId),
                });
            }
            queryClient.invalidateQueries({
                queryKey: queryKeys.applications.forTask(taskId),
            });
            // Invalidate all application counts
            queryClient.invalidateQueries({
                queryKey: ['applications', 'counts'],
            });
        },
    });
}

type WithdrawApplicationInput = {
    taskId: string;
    userId: string;
};

/** Call the `withdraw_application` RPC to retract the user's application. */
async function withdrawApplicationFn({ taskId, userId }: WithdrawApplicationInput) {
    const { data, error } = await supabase.rpc('withdraw_application', {
        p_task_id: taskId,
        p_applicant_id: userId,
    });

    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to withdraw');
    return result;
}

/**
 * Mutation hook for withdrawing an application.
 */
/**
 * Mutation hook to withdraw an application.
 * Optimistically sets the application status to "withdrawn", reverting on error.
 */
export function useWithdrawApplicationMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId }: { taskId: string }) =>
            withdrawApplicationFn({ taskId, userId: userId! }),
        onMutate: async ({ taskId }) => {
            if (!userId) return;

            await queryClient.cancelQueries({
                queryKey: queryKeys.applications.myStatus(taskId, userId),
            });

            const previousStatus = queryClient.getQueryData(
                queryKeys.applications.myStatus(taskId, userId)
            );

            // Optimistically update status to withdrawn
            queryClient.setQueryData(
                queryKeys.applications.myStatus(taskId, userId),
                { status: 'withdrawn' }
            );

            return { previousStatus, taskId };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousStatus && userId) {
                queryClient.setQueryData(
                    queryKeys.applications.myStatus(context.taskId, userId),
                    context.previousStatus
                );
            }
        },
        onSettled: (_data, _error, { taskId }) => {
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.applications.mine(userId),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.applications.myStatus(taskId, userId),
                });
            }
            queryClient.invalidateQueries({
                queryKey: queryKeys.applications.forTask(taskId),
            });
            queryClient.invalidateQueries({
                queryKey: ['applications', 'counts'],
            });
        },
    });
}

type AcceptApplicantInput = {
    taskId: string;
    applicantId: string;
    posterId: string;
};

/** Call the `accept_applicant` RPC. Used by the task poster. */
async function acceptApplicantFn({ taskId, applicantId, posterId }: AcceptApplicantInput) {
    const { data, error } = await supabase.rpc('accept_applicant', {
        p_task_id: taskId,
        p_applicant_id: applicantId,
        p_poster_id: posterId,
    });

    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to accept');
    return result;
}

/**
 * Mutation hook for accepting an applicant.
 * Invalidates task feed, applicant list, and counts.
 */
/** Mutation hook for the poster to accept an applicant. Invalidates tasks + applications. */
export function useAcceptApplicantMutation(posterId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId, applicantId }: { taskId: string; applicantId: string }) =>
            acceptApplicantFn({ taskId, applicantId, posterId: posterId! }),
        onSuccess: (_data, { taskId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
            queryClient.invalidateQueries({
                queryKey: queryKeys.applications.forTask(taskId),
            });
            queryClient.invalidateQueries({
                queryKey: ['applications', 'counts'],
            });
            queryClient.invalidateQueries({
                queryKey: ['applications', 'mine'],
            });
        },
    });
}

type RejectApplicantInput = {
    taskId: string;
    applicantId: string;
    posterId: string;
};

/** Call the `reject_applicant` RPC. Used by the task poster. */
async function rejectApplicantFn({ taskId, applicantId, posterId }: RejectApplicantInput) {
    const { data, error } = await supabase.rpc('reject_applicant', {
        p_task_id: taskId,
        p_applicant_id: applicantId,
        p_poster_id: posterId,
    });

    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to reject');
    return result;
}

/**
 * Mutation hook for rejecting an applicant.
 */
/** Mutation hook for the poster to reject an applicant. Invalidates tasks + applications. */
export function useRejectApplicantMutation(posterId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId, applicantId }: { taskId: string; applicantId: string }) =>
            rejectApplicantFn({ taskId, applicantId, posterId: posterId! }),
        onSuccess: (_data, { taskId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.applications.forTask(taskId),
            });
            queryClient.invalidateQueries({
                queryKey: ['applications', 'counts'],
            });
        },
    });
}

// ── Chat Mutations ─────────────────────────────────────────────

/** Send a message via the `send_message` RPC. */
async function sendMessageFn({
    roomId,
    senderId,
    message,
}: {
    roomId: string;
    senderId: string;
    message: string;
}) {
    const { data, error } = await supabase.rpc('send_message', {
        p_room_id: roomId,
        p_sender_id: senderId,
        p_message: message,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string; message_id?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to send message');
    return result;
}

/** Mutation hook to send a chat message. Invalidates messages + room list. */
export function useSendMessageMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ roomId, message }: { roomId: string; message: string }) =>
            sendMessageFn({ roomId, senderId: userId!, message }),
        onSuccess: (_data, { roomId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.messages(roomId),
            });
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.chat.rooms(userId),
                });
            }
        },
    });
}

/** Mark all unread messages in a room as seen. */
async function markMessagesSeenFn({ roomId, userId }: { roomId: string; userId: string }) {
    await supabase.rpc('mark_messages_seen', {
        p_room_id: roomId,
        p_user_id: userId,
    });
}

export function useMarkMessagesSeenMutation() {
    return useMutation({
        mutationFn: markMessagesSeenFn,
    });
}

// ── Task Completion Mutations ──────────────────────────────────

/** Tasker marks task as finished via `finish_task` RPC. */
async function finishTaskFn({ taskId, taskerId }: { taskId: string; taskerId: string }) {
    const { data, error } = await supabase.rpc('finish_task', {
        p_task_id: taskId,
        p_tasker_id: taskerId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to finish task');
    return result;
}

/** Mutation hook for the tasker to mark a task as finished. */
export function useFinishTaskMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId }: { taskId: string }) =>
            finishTaskFn({ taskId, taskerId: userId! }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

/** Poster confirms task completion via `confirm_task_completion` RPC. */
async function confirmTaskCompletionFn({ taskId, posterId }: { taskId: string; posterId: string }) {
    const { data, error } = await supabase.rpc('confirm_task_completion', {
        p_task_id: taskId,
        p_poster_id: posterId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to confirm completion');
    return result;
}

/** Mutation hook for the poster to confirm task completion. */
export function useConfirmTaskCompletionMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId }: { taskId: string }) =>
            confirmTaskCompletionFn({ taskId, posterId: userId! }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

// ── Notification Mutations ─────────────────────────────────────

/** Mark a single notification as read via RPC. */
async function markNotificationReadFn({
    notificationId,
    userId,
}: {
    notificationId: string;
    userId: string;
}) {
    const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return data;
}

/** Mutation hook to mark a single notification as read. */
export function useMarkNotificationReadMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ notificationId }: { notificationId: string }) =>
            markNotificationReadFn({ notificationId, userId: userId! }),
        onSuccess: () => {
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notifications.list(userId),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notifications.unreadCount(userId),
                });
            }
        },
    });
}

/** Mark all notifications as read via RPC. */
async function markAllNotificationsReadFn(userId: string) {
    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return data;
}

/** Mutation hook to mark all notifications as read. */
export function useMarkAllNotificationsReadMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: () => markAllNotificationsReadFn(userId!),
        onSuccess: () => {
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notifications.list(userId),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.notifications.unreadCount(userId),
                });
            }
        },
    });
}
