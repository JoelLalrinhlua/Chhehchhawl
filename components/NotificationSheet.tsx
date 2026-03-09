/**
 * NotificationSheet.tsx — Full-screen modal for the notification center.
 *
 * Shows a list of in-app notifications (application accepted/rejected,
 * task completion events). Supports mark-as-read and real-time updates.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
    useMarkAllNotificationsReadMutation,
    useMarkNotificationReadMutation,
} from '@/hooks/use-mutations';
import {
    useNotificationsQuery,
    type Notification,
} from '@/hooks/use-notification-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NotificationSheetProps {
    visible: boolean;
    onClose: () => void;
}

const ICON_MAP: Record<
    Notification['type'],
    { name: keyof typeof Ionicons.glyphMap; colorKey: 'statusGreen' | 'statusRed' | 'statusOrange' | 'accent' }
> = {
    application_accepted: { name: 'checkmark-circle', colorKey: 'statusGreen' },
    application_rejected: { name: 'close-circle', colorKey: 'statusRed' },
    task_pending_confirmation: { name: 'hourglass', colorKey: 'statusOrange' },
    task_completed: { name: 'trophy', colorKey: 'accent' },
};

export function NotificationSheet({ visible, onClose }: NotificationSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const { data: notifications = [], isLoading } = useNotificationsQuery(
        user?.id,
        visible
    );
    const markReadMutation = useMarkNotificationReadMutation(user?.id);
    const markAllReadMutation = useMarkAllNotificationsReadMutation(user?.id);

    // Realtime subscription for live notification updates
    useEffect(() => {
        if (!visible || !user?.id) return;

        const channel = supabase
            .channel('notifications-sheet')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.notifications.list(user.id),
                    });
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.notifications.unreadCount(user.id),
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [visible, user?.id]);

    const hasUnread = notifications.some((n) => !n.read);

    const handleMarkAllRead = useCallback(() => {
        if (!hasUnread) return;
        markAllReadMutation.mutate();
    }, [hasUnread, markAllReadMutation]);

    const handleTapNotification = useCallback(
        (item: Notification) => {
            if (!item.read) {
                markReadMutation.mutate({ notificationId: item.id });
            }
        },
        [markReadMutation]
    );

    const renderItem = useCallback(
        ({ item }: { item: Notification }) => {
            const iconCfg = ICON_MAP[item.type] ?? ICON_MAP.task_completed;
            const iconColor = colors[iconCfg.colorKey];

            return (
                <Pressable
                    style={[
                        styles.notifItem,
                        {
                            backgroundColor: item.read
                                ? colors.card
                                : iconColor + '08',
                            borderColor: item.read ? colors.border : iconColor + '20',
                        },
                    ]}
                    onPress={() => handleTapNotification(item)}
                >
                    <View
                        style={[
                            styles.notifIcon,
                            { backgroundColor: iconColor + '15' },
                        ]}
                    >
                        <Ionicons name={iconCfg.name} size={22} color={iconColor} />
                    </View>
                    <View style={styles.notifContent}>
                        <View style={styles.notifTitleRow}>
                            <Text
                                style={[
                                    styles.notifTitle,
                                    {
                                        color: colors.text,
                                        fontFamily: item.read
                                            ? FontFamily.medium
                                            : FontFamily.bold,
                                    },
                                ]}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>
                            {!item.read && (
                                <View
                                    style={[
                                        styles.unreadDot,
                                        { backgroundColor: colors.accent },
                                    ]}
                                />
                            )}
                        </View>
                        <Text
                            style={[
                                styles.notifBody,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                            numberOfLines={2}
                        >
                            {item.body}
                        </Text>
                        <Text
                            style={[
                                styles.notifTime,
                                {
                                    color: colors.textMuted,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                        >
                            {formatTimeAgo(item.created_at)}
                        </Text>
                    </View>
                </Pressable>
            );
        },
        [colors, handleTapNotification]
    );

    const renderEmpty = useCallback(
        () => (
            <View style={styles.emptyContainer}>
                <Ionicons
                    name="notifications-off-outline"
                    size={48}
                    color={colors.textMuted}
                />
                <Text
                    style={[
                        styles.emptyText,
                        { color: colors.textMuted, fontFamily: FontFamily.regular },
                    ]}
                >
                    {isLoading ? 'Loading notifications...' : 'No notifications yet'}
                </Text>
                {!isLoading && (
                    <Text
                        style={[
                            styles.emptySubtext,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        You'll be notified when someone accepts your application or completes a task.
                    </Text>
                )}
            </View>
        ),
        [colors, isLoading]
    );

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View
                style={[
                    styles.container,
                    {
                        backgroundColor: colors.background,
                        paddingTop: insets.top,
                        paddingBottom: insets.bottom,
                    },
                ]}
            >
                {/* Header */}
                <View
                    style={[
                        styles.header,
                        {
                            backgroundColor: colors.surface,
                            borderBottomColor: colors.border,
                        },
                    ]}
                >
                    <Pressable onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                    <Text
                        style={[
                            styles.headerTitle,
                            { color: colors.text, fontFamily: FontFamily.bold },
                        ]}
                    >
                        Notifications
                    </Text>
                    {hasUnread && (
                        <Pressable
                            onPress={handleMarkAllRead}
                            style={styles.markAllButton}
                            disabled={markAllReadMutation.isPending}
                        >
                            <Text
                                style={[
                                    styles.markAllText,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.medium,
                                    },
                                ]}
                            >
                                Read all
                            </Text>
                        </Pressable>
                    )}
                </View>

                {/* List */}
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                        styles.listContent,
                        notifications.length === 0 && styles.listContentEmpty,
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: Spacing.sm }} />
                    )}
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
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: FontSize.xl,
        marginLeft: Spacing.sm,
    },
    markAllButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    markAllText: {
        fontSize: FontSize.sm,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.huge,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    notifItem: {
        flexDirection: 'row',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        gap: Spacing.md,
    },
    notifIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifContent: {
        flex: 1,
    },
    notifTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: 2,
    },
    notifTitle: {
        fontSize: FontSize.md,
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    notifBody: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: 4,
    },
    notifTime: {
        fontSize: FontSize.xs,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.huge * 2,
        gap: Spacing.md,
        paddingHorizontal: Spacing.xl,
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
