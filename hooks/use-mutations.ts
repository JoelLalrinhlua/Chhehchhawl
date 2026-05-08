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
    userId: string; // Must match created_by for the RLS check to pass
    data: Partial<Task>;
};

/**
 * Partially update an existing task row.
 * The `.eq('created_by', userId)` guard means the update is a silent no-op
 * if the caller is not the task owner — matching the server-side RLS policy.
 */
async function updateTaskFn({ taskId, userId, data }: UpdateTaskInput) {
    const { error } = await supabase
        .from('tasks')
        .update(data)
        .eq('id', taskId)
        .eq('created_by', userId); // IDOR guard: only owner can update
    if (error) throw new Error(error.message);
}

/**
 * Mutation hook for updating a task (e.g. status change).
 * Requires `userId` so the ownership check can be included in the query.
 */
export function useUpdateTaskMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
            updateTaskFn({ taskId, userId: userId!, data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

/** Delete a task by ID — only succeeds if the caller owns the task. */
async function deleteTaskFn({ taskId, userId }: { taskId: string; userId: string }) {
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('created_by', userId); // IDOR guard: only owner can delete
    if (error) throw new Error(error.message);
}

/** Mutation hook to delete a task. Requires `userId` for the ownership check. */
export function useDeleteTaskMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: (taskId: string) => deleteTaskFn({ taskId, userId: userId! }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

// ── Application Mutations ──────────────────────────────────────

type ApplyForTaskInput = {
    taskId: string;
    message?: string;
};

/** Call the `apply_for_task` RPC to submit an application. */
async function applyForTaskFn({ taskId, message }: ApplyForTaskInput) {
    const { data, error } = await supabase.rpc('apply_for_task', {
        p_task_id: taskId,
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
            applyForTaskFn({ taskId, message }),
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

/** Send a message via the `send_message` RPC. Supports typed messages. */
async function sendMessageFn({
    roomId,
    senderId,
    message,
    messageType = 'text',
    metadata = null,
}: {
    roomId: string;
    senderId: string;
    message: string;
    messageType?: string;
    metadata?: any;
}) {
    const { data, error } = await supabase.rpc('send_message', {
        p_room_id: roomId,
        p_sender_id: senderId,
        p_message: message,
        p_message_type: messageType,
        p_metadata: metadata,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string; message_id?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to send message');
    return result;
}

/** Mutation hook to send a chat message. Supports text, image, location types. */
export function useSendMessageMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({
            roomId,
            message,
            messageType,
            metadata,
        }: {
            roomId: string;
            message: string;
            messageType?: string;
            metadata?: any;
        }) =>
            sendMessageFn({ roomId, senderId: userId!, message, messageType, metadata }),
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

// ── Live Location Mutations ────────────────────────────────────

/** Request live location sharing from the other user. */
async function requestLiveLocationFn({
    roomId,
    targetUserId,
}: {
    roomId: string;
    targetUserId: string;
}) {
    const { data, error } = await supabase.rpc('request_live_location', {
        p_room_id: roomId,
        p_target_user_id: targetUserId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string; session_id?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to request location');
    return result;
}

export function useRequestLiveLocationMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: requestLiveLocationFn,
        onSuccess: (_data, { roomId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.liveLocation(roomId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.messages(roomId),
            });
        },
    });
}

/** Offer live location (Tasker offering to Poster). Caller is the sharer. */
async function offerLiveLocationFn({
    roomId,
    targetUserId,
}: {
    roomId: string;
    targetUserId: string;
}) {
    const { data, error } = await supabase.rpc('offer_live_location', {
        p_room_id: roomId,
        p_target_user_id: targetUserId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string; session_id?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to offer location');
    return result;
}

export function useOfferLiveLocationMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: offerLiveLocationFn,
        onSuccess: (_data, { roomId }) => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.liveLocation(roomId),
            });
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.messages(roomId),
            });
        },
    });
}

/** Respond to a live location request. */
async function respondLiveLocationFn({
    sessionId,
    accept,
}: {
    sessionId: string;
    accept: boolean;
}) {
    const { data, error } = await supabase.rpc('respond_live_location', {
        p_session_id: sessionId,
        p_accept: accept,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to respond');
    return result;
}

export function useRespondLiveLocationMutation(roomId: string) {
    return useMutation({
        mutationFn: respondLiveLocationFn,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.liveLocation(roomId),
            });
        },
    });
}

/** Update live location coordinates. */
async function updateLiveLocationFn({
    sessionId,
    latitude,
    longitude,
}: {
    sessionId: string;
    latitude: number;
    longitude: number;
}) {
    const { data, error } = await supabase.rpc('update_live_location', {
        p_session_id: sessionId,
        p_latitude: latitude,
        p_longitude: longitude,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to update location');
    return result;
}

export function useUpdateLiveLocationMutation() {
    return useMutation({
        mutationFn: updateLiveLocationFn,
    });
}

/** Stop live location sharing. */
async function stopLiveLocationFn({ sessionId }: { sessionId: string }) {
    const { data, error } = await supabase.rpc('stop_live_location', {
        p_session_id: sessionId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to stop');
    return result;
}

export function useStopLiveLocationMutation(roomId: string) {
    return useMutation({
        mutationFn: stopLiveLocationFn,
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.liveLocation(roomId),
            });
        },
    });
}

/** Tasker marks task as finished via `finish_task` RPC. Returns tasker UPI + amount. */
async function finishTaskFn({ taskId, taskerId }: { taskId: string; taskerId: string }) {
    const { data, error } = await supabase.rpc('finish_task', {
        p_task_id: taskId,
        p_tasker_id: taskerId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string; tasker_upi_id?: string; amount?: number };
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

/** Poster marks payment as sent via `mark_payment_sent` RPC. */
async function markPaymentSentFn({ taskId, posterId }: { taskId: string; posterId: string }) {
    const { data, error } = await supabase.rpc('mark_payment_sent', {
        p_task_id: taskId,
        p_poster_id: posterId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to mark payment as sent');
    return result;
}

/** Mutation hook for the poster to mark payment as sent. */
export function useMarkPaymentSentMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId }: { taskId: string }) =>
            markPaymentSentFn({ taskId, posterId: userId! }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

/** Tasker confirms payment received via `confirm_payment_received` RPC. */
async function confirmPaymentReceivedFn({ taskId, taskerId }: { taskId: string; taskerId: string }) {
    const { data, error } = await supabase.rpc('confirm_payment_received', {
        p_task_id: taskId,
        p_tasker_id: taskerId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to confirm payment');
    return result;
}

/** Mutation hook for the tasker to confirm payment received (triggers task completion). */
export function useConfirmPaymentReceivedMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ taskId }: { taskId: string }) =>
            confirmPaymentReceivedFn({ taskId, taskerId: userId! }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
        },
    });
}

/** Delete (soft) a chat room via the `delete_chat_room` RPC. Only allowed when task is completed. */
async function deleteChatRoomFn({ roomId }: { roomId: string }) {
    const { data, error } = await supabase.rpc('delete_chat_room', {
        p_room_id: roomId,
    });
    if (error) throw new Error(error.message);
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'Failed to delete chat');
    return result;
}

/** Mutation hook for soft-deleting a completed chat room. */
export function useDeleteChatRoomMutation(userId: string | undefined) {
    return useMutation({
        mutationFn: ({ roomId }: { roomId: string }) => deleteChatRoomFn({ roomId }),
        onSuccess: () => {
            if (userId) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.chat.rooms(userId),
                });
            }
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
