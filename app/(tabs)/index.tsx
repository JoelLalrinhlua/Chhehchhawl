/**
 * (tabs)/index.tsx — Home / Dashboard screen.
 *
 * Displays a welcome greeting with the user’s first name and a set of
 * action cards (DashboardCard) for quick navigation: post a task, browse
 * tasks, view history, edit profile.
 */

import { NotificationSheet } from '@/components/NotificationSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadNotificationCountQuery } from '@/hooks/use-notification-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Dimensions,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const DashboardCard = ({
    title,
    subtitle,
    icon,
    onPress,
    delay = 0,
}: {
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    delay?: number;
}) => {
    const { colors } = useTheme();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View>
            <Animated.View style={animatedStyle}>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: colors.card }]}
                    onPress={onPress}
                    onPressIn={() => {
                        scale.value = withTiming(0.98, { duration: 100 });
                    }}
                    onPressOut={() => {
                        scale.value = withTiming(1, { duration: 100 });
                    }}
                    activeOpacity={0.9}
                >
                    <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                        <Ionicons name={icon} size={28} color={colors.text} />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

export default function DashboardScreen() {
    const { user, profile } = useAuth();
    const { colors } = useTheme();
    const { getMyPosts, getMyTasks } = useTasks();
    const [notifVisible, setNotifVisible] = useState(false);

    const { data: unreadCount = 0 } = useUnreadNotificationCountQuery(user?.id);

    // Realtime subscription for live badge updates
    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('home-notifications')
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
                        queryKey: queryKeys.notifications.unreadCount(user.id),
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const firstName = profile?.full_name?.split(' ')[0] || 'User';

    const { myPosts, tasksCompleted, totalEarned, tasksInProgress } = useMemo(() => {
        const posts = getMyPosts(user?.id || '');
        const tasks = getMyTasks(user?.id || '');
        const completed = tasks.filter(t => t.status === 'completed');
        const inProgress = tasks.filter(t => t.status === 'in-progress' || t.status === 'assigned').length;
        const totalEarnings = completed.reduce((sum, task) => sum + task.budget, 0);

        return {
            myPosts: posts,
            tasksCompleted: completed.length,
            totalEarned: totalEarnings,
            tasksInProgress: inProgress
        };
    }, [user?.id, getMyPosts, getMyTasks]);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.profileSection}>
                    <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                        ) : (
                            <Text style={[styles.avatarText, { color: colors.accent }]}>
                                {firstName[0]}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => setNotifVisible(true)}
                    >
                        <Ionicons name="notifications-outline" size={24} color={colors.text} />
                        {unreadCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                                <Text style={styles.badgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Image
                        source={require('@/assets/images/LOGO Chhehchhawl.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>
            </View>

            <ScrollView 
                style={styles.content} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Spacing.huge }}
            >
                {/* Welcome Section */}
                <Animated.View style={styles.welcomeSection}>
                    <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back,</Text>
                    <Text style={[styles.nameText, { color: colors.accent }]}>{firstName}</Text>
                    <Text style={[styles.taglineText, { color: colors.textMuted }]}>
                        Ready to make a difference today?
                    </Text>
                </Animated.View>

                {/* Action Cards */}
                <View style={styles.cardsContainer}>
                    <DashboardCard
                        title="Find Task"
                        subtitle="Browse available tasks near you"
                        icon="list"
                        onPress={() => router.push('/(tabs)/tasks')}
                        delay={100}
                    />
                    <DashboardCard
                        title="Post Task"
                        subtitle="Create a new task for helpers"
                        icon="add"
                        onPress={() => router.push('/create-task')}
                        delay={200}
                    />
                    <DashboardCard
                        title="Chat"
                        subtitle="Message your task contacts"
                        icon="chatbubble-ellipses-outline"
                        onPress={() => router.push('/(tabs)/chat')}
                        delay={300}
                    />
                </View>

                {/* Spacer to push stats down */}
                <View style={{ height: Dimensions.get('window').height * 0.3 }} />

                {/* Stats Section */}
                <Animated.View style={styles.statsSection}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Your Stats</Text>
                    <View style={styles.statsRow}>
                        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="send" size={24} color={colors.accent} />
                            <Text style={[styles.statNumber, { color: colors.text }]}>{myPosts.length}</Text>
                            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tasks Posted</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="checkmark-done" size={24} color={colors.statusGreen} />
                            <Text style={[styles.statNumber, { color: colors.text }]}>{tasksCompleted}</Text>
                            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tasks Completed</Text>
                        </View>
                    </View>
                    <View style={[styles.statsRow, { marginTop: Spacing.md }]}>
                        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="wallet" size={24} color={colors.statusOrange} />
                            <Text style={[styles.statNumber, { color: colors.text }]}>₹{totalEarned}</Text>
                            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Earned</Text>
                        </View>
                        <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="construct" size={24} color={colors.statusRed} />
                            <Text style={[styles.statNumber, { color: colors.text }]}>{tasksInProgress}</Text>
                            <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Progress</Text>
                        </View>
                    </View>
                </Animated.View>
            </ScrollView>

            <NotificationSheet
                visible={notifVisible}
                onClose={() => {
                    setNotifVisible(false);
                    if (user?.id) {
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.notifications.unreadCount(user.id),
                        });
                    }
                }}
                onOpenChat={() => {
                    setNotifVisible(false);
                    router.push('/(tabs)/chat');
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
        marginBottom: Spacing.xl,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badge: {
        position: 'absolute',
        top: 4,
        right: 2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: FontFamily.bold,
        lineHeight: 14,
    },
    logo: {
        width: 32,
        height: 32,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
    },
    welcomeSection: {
        marginBottom: Spacing.xl + Spacing.md,
    },
    welcomeText: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.regular,
        marginBottom: 4,
    },
    nameText: {
        fontSize: FontSize.hg,
        fontFamily: FontFamily.bold,
        marginBottom: Spacing.sm,
    },
    taglineText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
    },
    cardsContainer: {
        gap: Spacing.lg,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        gap: Spacing.lg,
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        lineHeight: 20,
    },
    statsSection: {
        paddingTop: Spacing.md,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.bold,
        marginBottom: Spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    statBox: {
        flex: 1,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        padding: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statNumber: {
        fontSize: FontSize.xxxl,
        fontFamily: FontFamily.bold,
        marginTop: Spacing.sm,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
    },
});
