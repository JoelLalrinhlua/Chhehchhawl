/**
 * (tabs)/chat.tsx — Chat list screen.
 *
 * Shows real chat rooms from Supabase via `useChatRoomsQuery`.
 * Tapping a room opens the ChatRoomSheet modal for that conversation.
 * Includes:
 *  - Search, pull-to-refresh, Realtime subscription for live updates.
 *  - Collapsible "Completed" section (collapsed by default).
 *  - Long-press on completed chat → delete with confirmation dialog.
 *  - "Poster" / "Tasker" role badge on each chat item.
 *  - Active task counter in header.
 */

import { ChatRoomSheet } from '@/components/ChatRoomSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChatRoomsQuery, type ChatRoom } from '@/hooks/use-chat-queries';
import { useDeleteChatRoomMutation } from '@/hooks/use-mutations';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
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
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [completedExpanded, setCompletedExpanded] = useState(false);
    const chevronRotation = useState(new Animated.Value(0))[0];

    const { data: rooms = [], isLoading, refetch } = useChatRoomsQuery(user?.id);
    const deleteMutation = useDeleteChatRoomMutation(user?.id);

    // Derive selectedRoom from fresh query data so it stays in sync
    const selectedRoom = useMemo(
        () => (selectedRoomId ? rooms.find((r) => r.room_id === selectedRoomId) ?? null : null),
        [selectedRoomId, rooms]
    );

    // Animate chevron on expand/collapse
    useEffect(() => {
        Animated.timing(chevronRotation, {
            toValue: completedExpanded ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [completedExpanded, chevronRotation]);

    const chevronStyle = {
        transform: [
            {
                rotate: chevronRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '90deg'],
                }),
            },
        ],
    };

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

    // Realtime: refresh room list when tasks table changes
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

    // Split rooms into active vs completed, filtered by search
    const { activeRooms, completedRooms } = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = q
            ? rooms.filter(
                (r) =>
                    r.other_user_name?.toLowerCase().includes(q) ||
                    r.task_title?.toLowerCase().includes(q)
            )
            : rooms;

        return {
            activeRooms: filtered.filter((r) => r.task_status !== 'completed'),
            completedRooms: filtered.filter((r) => r.task_status === 'completed'),
        };
    }, [rooms, search]);

    // Count active tasks the user is involved in across ALL rooms
    const activeTaskCount = useMemo(
        () => rooms.filter((r) => r.task_status !== 'completed').length,
        [rooms]
    );

    const handleCloseRoom = useCallback(() => {
        setSelectedRoomId(null);
        if (user?.id) {
            queryClient.invalidateQueries({
                queryKey: queryKeys.chat.rooms(user.id),
            });
        }
    }, [user?.id]);

    const handleLongPressCompleted = useCallback(
        (item: ChatRoom) => {
            Alert.alert(
                'Delete Chat',
                `Delete this conversation with ${item.other_user_name ?? 'Unknown'}?\n\nThis will only remove the chat from your list — the task history is preserved.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await deleteMutation.mutateAsync({ roomId: item.room_id });
                            } catch (err: any) {
                                Alert.alert('Error', err.message || 'Failed to delete chat');
                            }
                        },
                    },
                ]
            );
        },
        [deleteMutation]
    );

    const renderChatItem = useCallback(
        (item: ChatRoom, isCompleted: boolean) => {
            const isUserPoster = item.poster_id === user?.id;
            const roleLabel = isUserPoster ? 'Poster' : 'Tasker';
            const roleColor = isUserPoster ? colors.statusGreen : colors.accent;

            return (
                <TouchableOpacity
                    key={item.room_id}
                    style={[
                        styles.chatItem,
                        { backgroundColor: colors.card },
                        isCompleted && styles.chatItemCompleted,
                    ]}
                    onPress={() => setSelectedRoomId(item.room_id)}
                    onLongPress={isCompleted ? () => handleLongPressCompleted(item) : undefined}
                    delayLongPress={400}
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
                            <View style={styles.headerRight}>
                                {item.last_message_at && (
                                    <Text style={[styles.time, { color: colors.textMuted }]}>
                                        {formatRelativeTime(item.last_message_at)}
                                    </Text>
                                )}
                            </View>
                        </View>

                        {/* Role badge + task label row */}
                        <View style={styles.taskLabelRow}>
                            <View
                                style={[
                                    styles.roleBadge,
                                    { backgroundColor: roleColor + '18', borderColor: roleColor + '40' },
                                ]}
                            >
                                <Ionicons
                                    name={isUserPoster ? 'create-outline' : 'briefcase-outline'}
                                    size={9}
                                    color={roleColor}
                                />
                                <Text style={[styles.roleBadgeText, { color: roleColor }]}>
                                    {roleLabel}
                                </Text>
                            </View>
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
                    {/* Long-press hint for completed chats */}
                    {isCompleted && (
                        <Ionicons
                            name="ellipsis-vertical"
                            size={16}
                            color={colors.textMuted}
                            style={{ opacity: 0.5, marginLeft: 2 }}
                        />
                    )}
                </TouchableOpacity>
            );
        },
        [colors, user?.id, handleLongPressCompleted]
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

    // Build the flat list data: active rooms + completed section header + completed rooms (when expanded)
    type ListItem =
        | { type: 'room'; data: ChatRoom; isCompleted: boolean }
        | { type: 'completed-header' }
        | { type: 'empty' };

    const listData = useMemo<ListItem[]>(() => {
        const items: ListItem[] = activeRooms.map((r) => ({ type: 'room', data: r, isCompleted: false }));

        if (completedRooms.length > 0) {
            items.push({ type: 'completed-header' });
            if (completedExpanded) {
                completedRooms.forEach((r) => items.push({ type: 'room', data: r, isCompleted: true }));
            }
        }

        if (items.length === 0) {
            items.push({ type: 'empty' });
        }

        return items;
    }, [activeRooms, completedRooms, completedExpanded]);

    const renderListItem = useCallback(
        ({ item }: { item: ListItem }) => {
            if (item.type === 'empty') return renderEmpty();
            if (item.type === 'completed-header') {
                return (
                    <TouchableOpacity
                        style={[styles.completedHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => setCompletedExpanded((v) => !v)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.completedHeaderLeft}>
                            <Ionicons name="checkmark-done-circle-outline" size={18} color={colors.textMuted} />
                            <Text style={[styles.completedHeaderText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                Completed chats
                            </Text>
                            <View style={[styles.completedCountBadge, { backgroundColor: colors.textMuted + '20' }]}>
                                <Text style={[styles.completedCountText, { color: colors.textMuted }]}>
                                    {completedRooms.length}
                                </Text>
                            </View>
                        </View>
                        <Animated.View style={chevronStyle}>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </Animated.View>
                    </TouchableOpacity>
                );
            }
            return renderChatItem(item.data, item.isCompleted);
        },
        [colors, completedRooms.length, completedExpanded, chevronStyle, renderChatItem, renderEmpty]
    );

    const keyExtractor = useCallback(
        (item: ListItem, index: number) => {
            if (item.type === 'room') return item.data.room_id;
            if (item.type === 'completed-header') return 'completed-header';
            return `empty-${index}`;
        },
        []
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
                    {activeTaskCount > 0 && (
                        <Text style={[styles.activeCount, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            {activeTaskCount} active {activeTaskCount === 1 ? 'task' : 'tasks'}
                        </Text>
                    )}
                </View>
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
                data={listData}
                renderItem={renderListItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={[
                    styles.listContent,
                    listData.length === 1 && listData[0].type === 'empty' && styles.listContentEmpty,
                ]}
                showsVerticalScrollIndicator={false}
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
            {/* Keep sheet open but with loading state if room vanishes briefly during refetch */}
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
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
    },
    activeCount: {
        fontSize: FontSize.xs,
        marginTop: 2,
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
    chatItemCompleted: {
        opacity: 0.65,
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
        alignItems: 'center',
        marginBottom: 3,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        gap: 5,
        marginBottom: 2,
        flexWrap: 'nowrap',
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        gap: 2,
        flexShrink: 0,
    },
    roleBadgeText: {
        fontSize: 9,
        fontFamily: FontFamily.semiBold,
        letterSpacing: 0.2,
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
        flexShrink: 0,
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
    // ── Completed section header ──
    completedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    completedHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    completedHeaderText: {
        fontSize: FontSize.sm,
    },
    completedCountBadge: {
        paddingHorizontal: 7,
        paddingVertical: 1,
        borderRadius: 10,
    },
    completedCountText: {
        fontSize: 11,
        fontFamily: FontFamily.semiBold,
    },
});
