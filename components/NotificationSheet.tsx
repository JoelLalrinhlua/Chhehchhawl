/**
 * NotificationSheet.tsx — Full-screen notification center.
 *
 * Features:
 *  • Filter tabs: All | Messages | Applications | System
 *  • Unread dot indicator per item
 *  • "Mark all as read" button
 *  • Navigation callback on tap (open related chat or task)
 *  • Real-time Supabase subscription
 *  • Empty state with icon
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    useMarkAllNotificationsReadMutation,
    useMarkNotificationReadMutation,
} from '@/hooks/use-mutations';
import {
    useInfiniteNotificationsQuery,
    type Notification,
    type NotificationType,
} from '@/hooks/use-notification-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotificationSheetProps {
    visible: boolean;
    onClose: () => void;
    /** Called when user taps a notification with a chat reference_id */
    onOpenChat?: (roomId: string) => void;
}

type FilterTab = 'all' | 'messages' | 'applications' | 'system';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'messages', label: 'Messages' },
    { key: 'applications', label: 'Applications' },
    { key: 'system', label: 'System' },
];

const ICON_MAP: Record<NotificationType, {
    name: keyof typeof Ionicons.glyphMap;
    colorKey: 'statusGreen' | 'statusRed' | 'statusOrange' | 'accent';
}> = {
    application_received:       { name: 'person-add',          colorKey: 'accent' },
    application_accepted:       { name: 'checkmark-circle',    colorKey: 'statusGreen' },
    application_rejected:       { name: 'close-circle',        colorKey: 'statusRed' },
    task_pending_confirmation:  { name: 'hourglass',           colorKey: 'statusOrange' },
    task_completed:             { name: 'trophy',              colorKey: 'statusGreen' },
    new_message:                { name: 'chatbubble-ellipses', colorKey: 'accent' },
    task_cancelled:             { name: 'ban',                 colorKey: 'statusRed' },
};

function getFilterForType(type: NotificationType): FilterTab {
    if (type === 'new_message') return 'messages';
    if (type === 'application_received' || type === 'application_accepted' || type === 'application_rejected') return 'applications';
    return 'system';
}

export function NotificationSheet({ visible, onClose, onOpenChat }: NotificationSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

    const {
        data: notificationsData,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteNotificationsQuery(user?.id, visible);

    // Flatten all loaded pages into a single list
    const notifications = useMemo(
        () => (notificationsData?.pages ?? []).flatMap((p) => p),
        [notificationsData],
    );
    const markReadMutation = useMarkNotificationReadMutation(user?.id);
    const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);

    // Real-time subscription
    useEffect(() => {
        if (!visible || !user?.id) return;
        const channel = supabase
            .channel('notifications-sheet')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list(user.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(user.id) });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [visible, user?.id]);

    const filtered = useMemo(() => {
        if (activeFilter === 'all') return notifications;
        return notifications.filter(n => getFilterForType(n.type) === activeFilter);
    }, [notifications, activeFilter]);

    const hasUnread = notifications.some(n => !n.read);

    const handleTap = useCallback((item: Notification) => {
        if (!item.read) markReadMutation.mutate({ notificationId: item.id });
        if (item.reference_type === 'chat' && item.reference_id && onOpenChat) {
            onClose();
            setTimeout(() => onOpenChat(item.reference_id!), 300);
        }
    }, [markReadMutation, onOpenChat, onClose]);

    const handleMarkAllRead = useCallback(() => {
        if (hasUnread) markAllReadMutation.mutate();
    }, [hasUnread, markAllReadMutation]);

    const renderItem = useCallback(({ item }: { item: Notification }) => {
        const iconCfg = ICON_MAP[item.type] ?? ICON_MAP.task_completed;
        const iconColor = colors[iconCfg.colorKey];
        return (
            <Pressable
                style={[
                    styles.notifItem,
                    {
                        backgroundColor: item.read ? colors.card : iconColor + '10',
                        borderColor: item.read ? colors.border : iconColor + '30',
                    },
                ]}
                onPress={() => handleTap(item)}
            >
                <View style={[styles.notifIcon, { backgroundColor: iconColor + '18' }]}>
                    <Ionicons name={iconCfg.name} size={22} color={iconColor} />
                </View>
                <View style={styles.notifContent}>
                    <View style={styles.notifTitleRow}>
                        <Text
                            style={[styles.notifTitle, {
                                color: colors.text,
                                fontFamily: item.read ? FontFamily.medium : FontFamily.bold,
                            }]}
                            numberOfLines={1}
                        >
                            {item.title}
                        </Text>
                        {!item.read && (
                            <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
                        )}
                    </View>
                    <Text
                        style={[styles.notifBody, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                        numberOfLines={2}
                    >
                        {item.body}
                    </Text>
                    <Text style={[styles.notifTime, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        {formatTimeAgo(item.created_at)}
                    </Text>
                </View>
                {item.reference_type === 'chat' && (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 4 }} />
                )}
            </Pressable>
        );
    }, [colors, handleTap]);

    const renderEmpty = useCallback(() => (
        <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                {isLoading ? 'Loading...' : 'No notifications yet'}
            </Text>
            {!isLoading && (
                <Text style={[styles.emptySubtext, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                    You'll be notified about applications, messages, and task updates here.
                </Text>
            )}
        </View>
    ), [colors, isLoading]);

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <Pressable onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Notifications
                    </Text>
                    {hasUnread ? (
                        <Pressable
                            onPress={handleMarkAllRead}
                            style={styles.markAllButton}
                            disabled={markAllReadMutation.isPending}
                        >
                            <Text style={[styles.markAllText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                Mark all read
                            </Text>
                        </Pressable>
                    ) : (
                        <View style={styles.markAllButton} />
                    )}
                </View>

                {/* Filter Tabs */}
                <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                        {FILTER_TABS.map(tab => {
                            const isActive = activeFilter === tab.key;
                            const count = tab.key === 'all'
                                ? notifications.filter(n => !n.read).length
                                : notifications.filter(n => !n.read && getFilterForType(n.type) === tab.key).length;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    style={[
                                        styles.filterTab,
                                        isActive && { backgroundColor: colors.accent + '18', borderColor: colors.accent },
                                        !isActive && { borderColor: colors.border },
                                    ]}
                                    onPress={() => setActiveFilter(tab.key)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[
                                        styles.filterTabText,
                                        { color: isActive ? colors.accent : colors.textMuted, fontFamily: isActive ? FontFamily.semiBold : FontFamily.regular },
                                    ]}>
                                        {tab.label}
                                    </Text>
                                    {count > 0 && (
                                        <View style={[styles.filterBadge, { backgroundColor: colors.accent }]}>
                                            <Text style={styles.filterBadgeText}>{count > 9 ? '9+' : count}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Push notifications coming-soon banner */}
                <View style={[styles.comingSoonBanner, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' }]}>
                    <Ionicons name="construct-outline" size={14} color={colors.accent} />
                    <Text style={[styles.comingSoonText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                        Push notification pop-ups are still being built — coming in a future update!
                    </Text>
                </View>

                {/* List */}
                <FlatList
                    data={filtered}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={[
                        styles.listContent,
                        filtered.length === 0 && styles.listContentEmpty,
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <ActivityIndicator
                                size="small"
                                color={colors.accent}
                                style={{ paddingVertical: Spacing.lg }}
                            />
                        ) : hasNextPage ? (
                            <TouchableOpacity
                                style={[styles.loadMoreBtn, { borderColor: colors.border }]}
                                onPress={() => fetchNextPage()}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.loadMoreText, { color: colors.textMuted }]}>
                                    Load older notifications
                                </Text>
                            </TouchableOpacity>
                        ) : null
                    }
                />
            </View>
        </Modal>
    );
}

function formatTimeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: FontSize.xl, marginLeft: Spacing.sm },
    markAllButton: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, minWidth: 80, alignItems: 'flex-end' },
    markAllText: { fontSize: FontSize.sm },
    filterBar: { borderBottomWidth: 1 },
    filterScroll: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.sm },
    filterTab: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.md, paddingVertical: 6,
        borderRadius: BorderRadius.full, borderWidth: 1,
    },
    filterTabText: { fontSize: FontSize.sm },
    filterBadge: {
        minWidth: 18, height: 18, borderRadius: 9,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
    },
    filterBadgeText: { color: '#FFF', fontSize: 10, fontFamily: FontFamily.bold },
    listContent: {
        paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100,
    },
    listContentEmpty: { flexGrow: 1 },
    notifItem: {
        flexDirection: 'row', padding: Spacing.md,
        borderRadius: BorderRadius.lg, borderWidth: 1, gap: Spacing.md,
        alignItems: 'center',
    },
    notifIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    notifContent: { flex: 1 },
    notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
    notifTitle: { fontSize: FontSize.md, flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },
    notifBody: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: 4 },
    notifTime: { fontSize: FontSize.xs },
    emptyContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        paddingVertical: Spacing.huge * 2, gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
    },
    emptyText: { fontSize: FontSize.md, textAlign: 'center' },
    emptySubtext: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    loadMoreBtn: {
        alignItems: 'center' as const,
        paddingVertical: Spacing.md,
        marginTop: Spacing.sm,
        borderTopWidth: 1,
    },
    loadMoreText: { fontSize: FontSize.sm, fontFamily: FontFamily.medium },
    comingSoonBanner: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: Spacing.sm,
        marginHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    comingSoonText: { fontSize: FontSize.xs, flex: 1, lineHeight: 16 },
});
