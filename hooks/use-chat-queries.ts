/**
 * use-chat-queries.ts — TanStack Query hooks for the chat system.
 *
 * `useChatRoomsQuery`  — fetches chat rooms for the current user.
 * `useChatMessagesQuery` — fetches messages for a specific chat room.
 * `useLiveLocationSessionQuery` — fetches active live location session for a room.
 */

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

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
    task_budget: number | null;
    tasker_upi_id: string | null;
}

/** Metadata for image messages. */
export interface ImageMessageMetadata {
    image_url: string;
    width?: number;
    height?: number;
    file_size?: number;
}

/** Metadata for location share messages. */
export interface LocationShareMetadata {
    latitude: number;
    longitude: number;
    address?: string;
}

/** Metadata for live location request/response messages. */
export interface LiveLocationMetadata {
    session_id: string;
    status?: 'pending' | 'accepted' | 'denied' | 'active' | 'stopped' | 'expired';
    requester_id?: string;
    sharer_id?: string;
}

/** Metadata for payment_request messages sent in chat. */
export interface PaymentRequestMetadata {
    upi_id: string;
    amount: number;
    task_title: string;
}

/** Message types supported by the chat system. */
export type MessageType = 'text' | 'image' | 'location_share' | 'location_request' | 'location_response' | 'system' | 'location_offer' | 'payment_request';

/** Shape of a chat message row. */
export interface ChatMessage {
    id: string;
    room_id: string;
    sender_id: string;
    message: string;
    message_type: MessageType;
    metadata: ImageMessageMetadata | LocationShareMetadata | LiveLocationMetadata | null;
    created_at: string;
    seen: boolean;
}

/** Shape of a live location session. */
export interface LiveLocationSession {
    id: string;
    room_id: string;
    requester_id: string;
    sharer_id: string;
    status: 'pending' | 'accepted' | 'denied' | 'active' | 'stopped' | 'expired';
    latitude: number | null;
    longitude: number | null;
    last_updated_at: string | null;
    expires_at: string | null;
    created_at: string;
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

/** Number of messages fetched per page. */
export const CHAT_PAGE_SIZE = 50;

/**
 * Fetch one page of messages for a chat room.
 * Pages are in DESCENDING order (newest first) so that:
 *  • Page 0 → most recent 50 messages
 *  • Page 1 → the 50 messages before those, etc.
 * The inverted FlatList in ChatRoomSheet displays them correctly without reversal.
 */
async function fetchChatMessagesPage(
    roomId: string,
    pageParam: number,
): Promise<ChatMessage[]> {
    const from = pageParam * CHAT_PAGE_SIZE;
    const to = from + CHAT_PAGE_SIZE - 1;

    const { data, error } = await supabase
        .from('messages')
        .select('id, room_id, sender_id, message, message_type, metadata, created_at, seen')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((m) => ({
        ...m,
        message_type: m.message_type || 'text',
        metadata: m.metadata ?? null,
    })) as ChatMessage[];
}

/**
 * Infinite-scroll hook for chat messages.
 * Returns pages in DESC order (newest page first).
 * Compatible with the `inverted` FlatList in ChatRoomSheet:
 *  • Page 0 items (newest) render at the bottom of the screen.
 *  • onEndReached on the inverted list fires when user scrolls UP → loads older page.
 */
export function useChatMessagesQuery(roomId: string | undefined, enabled: boolean = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.chat.messages(roomId ?? ''),
        queryFn: ({ pageParam }) => fetchChatMessagesPage(roomId!, pageParam as number),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length < CHAT_PAGE_SIZE ? undefined : allPages.length,
        enabled: !!roomId && enabled,
        staleTime: 5 * 1000,
    });
}

/** Fetch the active live location session for a room. */
async function fetchLiveLocationSession(roomId: string): Promise<LiveLocationSession | null> {
    const { data, error } = await supabase
        .from('live_location_sessions')
        .select('*')
        .eq('room_id', roomId)
        .in('status', ['pending', 'active', 'accepted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data as LiveLocationSession | null;
}

/** Hook to fetch the active live location session for a room. */
export function useLiveLocationSessionQuery(roomId: string | undefined, enabled: boolean = true) {
    return useQuery({
        queryKey: queryKeys.chat.liveLocation(roomId ?? ''),
        queryFn: () => fetchLiveLocationSession(roomId!),
        enabled: !!roomId && enabled,
        staleTime: 3 * 1000,
        refetchInterval: 5 * 1000,
    });
}
