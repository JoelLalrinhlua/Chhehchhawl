/**
 * (tabs)/chat.tsx — Chat list screen.
 *
 * Shows real chat rooms from Supabase via `useChatRoomsQuery`.
 * Tapping a room opens the ChatRoomSheet modal for that conversation.
 * Includes search, pull-to-refresh, and Realtime subscription for live updates.
 */

import { ChatRoomSheet } from '@/components/ChatRoomSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChatRoomsQuery, type ChatRoom } from '@/hooks/use-chat-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

    const { data: rooms = [], isLoading, refetch } = useChatRoomsQuery(user?.id);

    // Derive selectedRoom from fresh query data so it stays in sync
    const selectedRoom = useMemo(
        () => (selectedRoomId ? rooms.find((r) => r.room_id === selectedRoomId) ?? null : null),
        [selectedRoomId, rooms]
    );

    // Realtime: refresh room list when any message is inserted
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('chat-list-messages')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.chat.rooms(user.id),
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    // Realtime: refresh room list when tasks table changes (completion flow)
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('chat-list-tasks')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'tasks' },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.chat.rooms(user.id),
                    });
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.tasks.all,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const filteredRooms = useMemo(() => {
        if (!search.trim()) return rooms;
        const q = search.toLowerCase();
        return rooms.filter(
            (r) =>
                r.other_user_name?.toLowerCase().includes(q) ||
                r.task_title?.toLowerCase().includes(q)
        );
    }, [rooms, search]);

    const handleCloseRoom = useCallback(() => {
        setSelectedRoomId(null);
        // Refresh rooms to update unread counts
        if (user?.id) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.rooms(user.id),
            });
        }
    }, [user?.id]);

    const renderItem = useCallback(
        ({ item }: { item: ChatRoom }) => {
            const isCompleted = item.task_status === 'completed';
            return (
                <TouchableOpacity
                    style={[
                        styles.chatItem,
                        { backgroundColor: colors.card },
                        isCompleted && { opacity: 0.5 },
                    ]}
                    onPress={() => setSelectedRoomId(item.room_id)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                        {item.other_user_avatar ? (
                            <Image
                                source={{ uri: item.other_user_avatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={[styles.avatarText, { color: colors.text }]}>
                                {(item.other_user_name ?? '?')[0].toUpperCase()}
                            </Text>
                        )}
                    </View>
                    <View style={styles.chatContent}>
                        <View style={styles.chatHeader}>
                            <Text
                                style={[styles.name, { color: colors.text }]}
                                numberOfLines={1}
                            >
                                {item.other_user_name ?? 'Unknown'}
                            </Text>
                            {item.last_message_at && (
                                <Text style={[styles.time, { color: colors.textMuted }]}>
                                    {formatRelativeTime(item.last_message_at)}
                                </Text>
                            )}
                        </View>
                        <View style={styles.taskLabelRow}>
                            <Text
                                style={[
                                    styles.taskLabel,
                                    { color: colors.textMuted, fontFamily: FontFamily.regular },
                                ]}
                                numberOfLines={1}
                            >
                                {item.task_title}
                            </Text>
                            {isCompleted && (
                                <View style={[styles.completedTag, { backgroundColor: colors.textMuted + '20' }]}>
                                    <Ionicons name="checkmark-circle" size={10} color={colors.textMuted} />
                                    <Text style={[styles.completedTagText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                        Done
                                    </Text>
                                </View>
                            )}
                        </View>
                        {item.last_message && (
                            <Text
                                style={[
                                    styles.message,
                                    {
                                        color: item.unread_count > 0 ? colors.text : colors.textMuted,
                                        fontFamily:
                                            item.unread_count > 0
                                                ? FontFamily.medium
                                                : FontFamily.regular,
                                    },
                                ]}
                                numberOfLines={1}
                            >
                                {item.last_message}
                            </Text>
                        )}
                    </View>
                    {item.unread_count > 0 && (
                        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                            <Text style={styles.badgeText}>
                                {item.unread_count > 99 ? '99+' : item.unread_count}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            );
        },
        [colors]
    );

    const renderEmpty = useCallback(
        () => (
            <View style={styles.emptyContainer}>
                <Ionicons
                    name="chatbubbles-outline"
                    size={48}
                    color={colors.textMuted}
                />
                <Text
                    style={[
                        styles.emptyText,
                        { color: colors.textMuted, fontFamily: FontFamily.regular },
                    ]}
                >
                    {isLoading
                        ? 'Loading conversations...'
                        : 'No conversations yet'}
                </Text>
                {!isLoading && (
                    <Text
                        style={[
                            styles.emptySubtext,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        When you accept or get accepted for a task, a chat will appear here.
                    </Text>
                )}
            </View>
        ),
        [colors, isLoading]
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
            </View>

            {rooms.length > 0 && (
                <View style={styles.searchContainer}>
                    <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                        <Ionicons name="search" size={20} color={colors.textMuted} />
                        <TextInput
                            style={[styles.input, { color: colors.text }]}
                            placeholder="Search messages..."
                            placeholderTextColor={colors.textMuted}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>
            )}

            <FlatList
                data={filteredRooms}
                renderItem={renderItem}
                keyExtractor={(item) => item.room_id}
                contentContainerStyle={[
                    styles.listContent,
                    filteredRooms.length === 0 && styles.listContentEmpty,
                ]}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmpty}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={refetch}
                        tintColor={colors.accent}
                    />
                }
            />

            {selectedRoom && (
                <ChatRoomSheet
                    roomId={selectedRoom.room_id}
                    taskId={selectedRoom.task_id}
                    taskTitle={selectedRoom.task_title}
                    taskStatus={selectedRoom.task_status}
                    otherUserName={selectedRoom.other_user_name}
                    taskerCompleted={selectedRoom.tasker_completed}
                    posterConfirmed={selectedRoom.poster_confirmed}
                    posterId={selectedRoom.poster_id}
                    taskerId={selectedRoom.tasker_id}
                    visible={!!selectedRoom}
                    onClose={handleCloseRoom}
                />
            )}
            {/* Keep sheet open but with empty state if room vanishes briefly during refetch */}
            {selectedRoomId && !selectedRoom && (
                <Modal visible animationType="slide" statusBarTranslucent onRequestClose={handleCloseRoom}>
                    <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

// ── Helpers ────────────────────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
    },
    searchContainer: {
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        fontFamily: FontFamily.regular,
        fontSize: FontSize.md,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.huge,
        gap: Spacing.md,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.xl,
        gap: Spacing.md,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.bold,
    },
    chatContent: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    name: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        flex: 1,
        marginRight: Spacing.sm,
    },
    taskLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    taskLabel: {
        fontSize: FontSize.xs,
        flexShrink: 1,
    },
    completedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        gap: 3,
    },
    completedTagText: {
        fontSize: 9,
    },
    loadingOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    time: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
    },
    message: {
        fontSize: FontSize.sm,
    },
    badge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: FontFamily.bold,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.huge * 2,
        paddingHorizontal: Spacing.xxl,
        gap: Spacing.md,
    },
    emptyText: {
        fontSize: FontSize.md,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
});
