/**
 * use-notification-queries.ts — TanStack Query hooks for notifications.
 */

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

export type NotificationType =
    | 'application_accepted'
    | 'application_rejected'
    | 'application_received'
    | 'task_pending_confirmation'
    | 'task_completed'
    | 'new_message'
    | 'task_cancelled';

/** Shape of a notification row returned by `get_my_notifications` RPC. */
export interface Notification {
    id: string;
    type: NotificationType;
    task_id: string;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
    reference_id: string | null;
    reference_type: 'chat' | 'task' | null;
}

async function fetchNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase.rpc('get_my_notifications', {
        p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as Notification[];
}

export function useNotificationsQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.notifications.list(userId ?? ''),
        queryFn: () => fetchNotifications(userId!),
        enabled: !!userId && enabled,
        staleTime: 10 * 1000,
    });
}

async function fetchUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
    });
    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
}

export function useUnreadNotificationCountQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.notifications.unreadCount(userId ?? ''),
        queryFn: () => fetchUnreadCount(userId!),
        enabled: !!userId && enabled,
        staleTime: 10 * 1000,
        refetchInterval: 30 * 1000,
    });
}

async function fetchNewApplicantsCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_new_applicants_count', {
        p_user_id: userId,
    });
    if (error) return 0;
    return (data ?? 0) as number;
}

export function useNewApplicantsCountQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: ['notifications', 'new-applicants', userId ?? ''],
        queryFn: () => fetchNewApplicantsCount(userId!),
        enabled: !!userId && enabled,
        staleTime: 20 * 1000,
        refetchInterval: 60 * 1000,
    });
}
