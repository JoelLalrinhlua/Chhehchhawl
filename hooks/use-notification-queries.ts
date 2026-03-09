/**
 * use-notification-queries.ts — TanStack Query hooks for notifications.
 *
 * `useNotificationsQuery`            — fetches the user's notifications list.
 * `useUnreadNotificationCountQuery`  — fetches unread notification count.
 */

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Shape of a notification row returned by `get_my_notifications` RPC. */
export interface Notification {
    id: string;
    type: 'application_accepted' | 'application_rejected' | 'task_pending_confirmation' | 'task_completed';
    task_id: string;
    title: string;
    body: string;
    read: boolean;
    created_at: string;
}

/** Fetch notifications for the given user via RPC. */
async function fetchNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase.rpc('get_my_notifications', {
        p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    return (data ?? []) as Notification[];
}

/** Hook to fetch the current user's notifications list. */
export function useNotificationsQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.notifications.list(userId ?? ''),
        queryFn: () => fetchNotifications(userId!),
        enabled: !!userId && enabled,
        staleTime: 10 * 1000,
    });
}

/** Fetch unread notification count for the given user. */
async function fetchUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    return (data ?? 0) as number;
}

/** Hook to fetch the current user's unread notification count. */
export function useUnreadNotificationCountQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.notifications.unreadCount(userId ?? ''),
        queryFn: () => fetchUnreadCount(userId!),
        enabled: !!userId && enabled,
        staleTime: 10 * 1000,
        refetchInterval: 30 * 1000, // Poll every 30s as fallback
    });
}
