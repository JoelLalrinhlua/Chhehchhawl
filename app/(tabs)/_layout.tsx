/**
 * (tabs)/_layout.tsx — Bottom-tab navigator with badge indicators.
 *
 * Badges:
 *  • Home tab    — unread notification count
 *  • Chat tab    — total unread messages across active rooms
 *  • History tab — new applicants on user's posted tasks or accepted applications
 */

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChatRoomsQuery } from '@/hooks/use-chat-queries';
import {
    useNewApplicantsCountQuery,
    useUnreadNotificationCountQuery,
} from '@/hooks/use-notification-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

// ── Badge helpers ──────────────────────────────────────────────
function Badge({ count, color }: { count: number; color: string }) {
    if (count <= 0) return null;
    return (
        <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count > 9 ? '9+' : count}</Text>
        </View>
    );
}

function RedDot({ color }: { color: string }) {
    return <View style={[styles.redDot, { backgroundColor: color }]} />;
}

// ── Main layout ────────────────────────────────────────────────
export default function TabLayout() {
    const { colors } = useTheme();
    const { user } = useAuth();

    // Badge counts
    const { data: rooms = [] } = useChatRoomsQuery(user?.id);
    const { data: notifUnread = 0 } = useUnreadNotificationCountQuery(user?.id);
    const { data: newApplicants = 0 } = useNewApplicantsCountQuery(user?.id);

    const totalChatUnread = useMemo(
        () => rooms
            .filter(r => r.task_status !== 'completed')
            .reduce((s, r) => s + (r.unread_count || 0), 0),
        [rooms]
    );

    // Realtime: keep badge counts live
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase
            .channel('tab-badges')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms(user.id) });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(user.id) });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_applications' }, () => {
                queryClient.invalidateQueries({ queryKey: ['notifications', 'new-applicants', user.id] });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: '#666',
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.tabBarBorder,
                    borderTopWidth: 1,
                    height: Platform.OS === 'ios' ? 88 : 64,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                    paddingTop: 8,
                },
                tabBarShowLabel: false,
                animation: 'shift',
                sceneStyle: { backgroundColor: colors.background },
            }}
        >
            {/* Home */}
            <Tabs.Screen
                name="index"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.iconContainer}>
                            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                            <Badge count={notifUnread} color={colors.statusRed} />
                            {focused && <View style={[styles.indicator, { backgroundColor: color }]} />}
                        </View>
                    ),
                }}
            />

            {/* Tasks */}
            <Tabs.Screen
                name="tasks"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.iconContainer}>
                            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
                            {focused && <View style={[styles.indicator, { backgroundColor: color }]} />}
                        </View>
                    ),
                }}
            />

            {/* Chat */}
            <Tabs.Screen
                name="chat"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                                size={24}
                                color={color}
                            />
                            <Badge count={totalChatUnread} color={colors.statusRed} />
                            {focused && <View style={[styles.indicator, { backgroundColor: color }]} />}
                        </View>
                    ),
                }}
            />

            {/* History */}
            <Tabs.Screen
                name="history"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.iconContainer}>
                            <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
                            {newApplicants > 0 && <RedDot color={colors.statusRed} />}
                            {focused && <View style={[styles.indicator, { backgroundColor: color }]} />}
                        </View>
                    ),
                }}
            />

            {/* Profile */}
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarIcon: ({ color, focused }) => (
                        <View style={styles.iconContainer}>
                            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                            {focused && <View style={[styles.indicator, { backgroundColor: color }]} />}
                        </View>
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: 50,
    },
    indicator: {
        position: 'absolute',
        bottom: -8,
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    badge: {
        position: 'absolute',
        top: 0,
        right: 2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: 'bold',
        lineHeight: 12,
    },
    redDot: {
        position: 'absolute',
        top: 2,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
