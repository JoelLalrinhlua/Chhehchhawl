/**
 * use-chat-queries.ts — TanStack Query hooks for the chat system.
 *
 * `useChatRoomsQuery`  — fetches chat rooms for the current user.
 * `useChatMessagesQuery` — fetches messages for a specific chat room.
 */

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

/** Shape of a chat room as returned by the `get_my_chat_rooms` RPC. */
export interface ChatRoom {
    room_id: string;
    task_id: string;
    task_title: string;
    task_status: string;
    other_user_id: string;
    other_user_name: string | null;
    other_user_avatar: string | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
    created_at: string;
    tasker_completed: boolean;
    poster_confirmed: boolean;
    poster_id: string;
    tasker_id: string;
}

/** Shape of a chat message row. */
export interface ChatMessage {
    id: string;
    room_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    seen: boolean;
}

/** Fetch chat rooms for the given user via RPC. */
async function fetchChatRooms(userId: string): Promise<ChatRoom[]> {
    const { data, error } = await supabase.rpc('get_my_chat_rooms', {
        p_user_id: userId,
    });

    if (error) throw new Error(error.message);
    return (data ?? []) as ChatRoom[];
}

/** Hook to fetch the current user's chat rooms. */
export function useChatRoomsQuery(userId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.chat.rooms(userId ?? ''),
        queryFn: () => fetchChatRooms(userId!),
        enabled: !!userId && enabled,
        staleTime: 10 * 1000,
    });
}

/** Fetch messages for a specific chat room. */
async function fetchChatMessages(roomId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as ChatMessage[];
}

/** Hook to fetch messages for a specific chat room. */
export function useChatMessagesQuery(roomId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.chat.messages(roomId ?? ''),
        queryFn: () => fetchChatMessages(roomId!),
        enabled: !!roomId && enabled,
        staleTime: 5 * 1000,
        refetchInterval: 30 * 1000, // Poll every 30s as fallback
    });
}
