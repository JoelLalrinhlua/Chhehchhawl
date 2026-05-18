/**
 * (tabs)/index.tsx — Home / Dashboard screen.
 *
 * "Your Stats" section shows accurate data fetched directly from Supabase
 * (not the open-only task feed cache). Users can toggle between their
 * Tasker view (what they've done for others) and their Poster view
 * (tasks they've hired out).
 *
 * A Supabase realtime subscription on the `tasks` table and `task_applications`
 * table keeps stats fresh whenever anything relevant changes.
 */

import { NotificationSheet } from '@/components/NotificationSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadNotificationCountQuery } from '@/hooks/use-notification-queries';
import { useUserStatsQuery } from '@/hooks/use-task-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated2, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Rank system (tasker completions) ────────────────────────────────────────
type Rank = { label: string; emoji: string; min: number; color: string };
const RANKS: Rank[] = [
    { label: 'Newbie',  emoji: '🌱', min: 0,  color: '#6BCB77' },
    { label: 'Helper',  emoji: '🙌', min: 1,  color: '#4D9FFF' },
    { label: 'Pro',     emoji: '⭐', min: 5,  color: '#FFD166' },
    { label: 'Expert',  emoji: '🔥', min: 15, color: '#F5604F' },
    { label: 'Legend',  emoji: '👑', min: 40, color: '#BF5AF2' },
];
function getRank(n: number): Rank {
    let r = RANKS[0];
    for (const rank of RANKS) if (n >= rank.min) r = rank;
    return r;
}
function getNextRank(n: number): { rank: Rank; remaining: number } | null {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (RANKS[i].min > n) return { rank: RANKS[i], remaining: RANKS[i].min - n };
    }
    return null;
}

// ── Rupee formatter ─────────────────────────────────────────────────────────
function fmt(amount: number) {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toLocaleString('en-IN')}`;
}

// ── DashboardCard ────────────────────────────────────────────────────────────
function DashboardCard({
    title, subtitle, icon, onPress,
}: {
    title: string; subtitle: string;
    icon: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
    const { colors } = useTheme();
    const scale = useSharedValue(1);
    const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <Animated2.View style={anim}>
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.card }]}
                onPress={onPress}
                onPressIn={() => { scale.value = withTiming(0.97, { duration: 100 }); }}
                onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
                activeOpacity={0.9}
            >
                <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
                    <Ionicons name={icon} size={28} color={colors.text} />
                </View>
                <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </Animated2.View>
    );
}

// ── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({
    icon, value, label, accentColor, colors,
}: {
    icon: keyof typeof Ionicons.glyphMap; value: string | number;
    label: string; accentColor: string; colors: any;
}) {
    return (
        <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.statPillIcon, { backgroundColor: accentColor + '18' }]}>
                <Ionicons name={icon} size={16} color={accentColor} />
            </View>
            <View>
                <Text style={[styles.statPillValue, { color: colors.text }]}>{value}</Text>
                <Text style={[styles.statPillLabel, { color: colors.textMuted }]}>{label}</Text>
            </View>
        </View>
    );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen() {
    const { user, profile, isAuthenticated } = useAuth();
    const { colors } = useTheme();
    const [notifVisible, setNotifVisible] = useState(false);
    const [statsMode, setStatsMode] = useState<'tasker' | 'poster'>('tasker');

    const { data: unreadCount = 0 } = useUnreadNotificationCountQuery(user?.id);
    const { data: stats, isLoading: statsLoading } = useUserStatsQuery(user?.id, isAuthenticated);

    // Progress bar animation for tasker rank
    const progressAnim = useRef(new Animated.Value(0)).current;
    const rank = getRank(stats?.tasksCompleted ?? 0);
    const nextRankInfo = getNextRank(stats?.tasksCompleted ?? 0);
    const progressPct = nextRankInfo
        ? ((stats?.tasksCompleted ?? 0) - rank.min) / (nextRankInfo.rank.min - rank.min)
        : 1;

    useEffect(() => {
        if (!statsLoading) {
            Animated.timing(progressAnim, {
                toValue: progressPct,
                duration: 900,
                delay: 200,
                useNativeDriver: false,
            }).start();
        }
    }, [statsLoading, progressPct]);

    // ── Real-time stats invalidation ──────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;

        // Invalidate stats whenever any of this user's tasks or applications change
        const tasksChannel = supabase
            .channel('home-task-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.tasks.userStats(user.id) });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_applications' }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.tasks.userStats(user.id) });
            })
            .subscribe();

        // Also keep notification badge live
        const notifChannel = supabase
            .channel('home-notifications')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(user.id) });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(notifChannel);
        };
    }, [user?.id]);

    const firstName = profile?.full_name?.split(' ')[0] || 'User';
    const acceptanceRate =
        stats && stats.applicationsTotal > 0
            ? Math.round((stats.applicationsAccepted / stats.applicationsTotal) * 100)
            : null;

    const dash = statsLoading ? '—' : undefined;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                    {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <Text style={[styles.avatarText, { color: colors.accent }]}>{firstName[0]}</Text>
                    )}
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setNotifVisible(true)}>
                        <Ionicons name="notifications-outline" size={24} color={colors.text} />
                        {unreadCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
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
                contentContainerStyle={styles.scrollContent}
            >
                {/* Welcome */}
                <View style={styles.welcomeSection}>
                    <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back,</Text>
                    <Text style={[styles.nameText, { color: colors.accent }]}>{firstName}</Text>
                    <Text style={[styles.taglineText, { color: colors.textMuted }]}>
                        Ready to make a difference today?
                    </Text>
                </View>

                {/* Action Cards */}
                <View style={styles.cardsContainer}>
                    <DashboardCard title="Find Task" subtitle="Browse available tasks near you" icon="list" onPress={() => router.push('/(tabs)/tasks')} />
                    <DashboardCard title="Post Task" subtitle="Create a new task for helpers" icon="add" onPress={() => router.push('/create-task')} />
                    <DashboardCard title="Chat" subtitle="Message your task contacts" icon="chatbubble-ellipses-outline" onPress={() => router.push('/(tabs)/chat')} />
                </View>

                {/* ── spacer pushes stats below the fold ── */}
                <View style={{ height: Dimensions.get('window').height * 0.28 }} />

                {/* ── Stats Section ── */}
                <View style={styles.statsSection}>

                    {/* Header + mode toggle */}
                    <View style={styles.statsHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Stats</Text>
                        {/* Rank badge — always shows tasker rank */}
                        <View style={[styles.rankBadge, { backgroundColor: rank.color + '20', borderColor: rank.color + '50' }]}>
                            <Text style={styles.rankEmoji}>{rank.emoji}</Text>
                            <Text style={[styles.rankLabel, { color: rank.color }]}>{rank.label}</Text>
                        </View>
                    </View>

                    {/* Tasker / Poster toggle */}
                    <View style={[styles.modeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={[styles.modeBtn, statsMode === 'tasker' && { backgroundColor: colors.accent }]}
                            onPress={() => setStatsMode('tasker')}
                        >
                            <Ionicons name="briefcase-outline" size={14} color={statsMode === 'tasker' ? '#fff' : colors.textMuted} />
                            <Text style={[styles.modeBtnText, { color: statsMode === 'tasker' ? '#fff' : colors.textMuted }]}>As Tasker</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeBtn, statsMode === 'poster' && { backgroundColor: colors.accent }]}
                            onPress={() => setStatsMode('poster')}
                        >
                            <Ionicons name="megaphone-outline" size={14} color={statsMode === 'poster' ? '#fff' : colors.textMuted} />
                            <Text style={[styles.modeBtnText, { color: statsMode === 'poster' ? '#fff' : colors.textMuted }]}>As Poster</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── TASKER VIEW ── */}
                    {statsMode === 'tasker' && (
                        <>
                            {/* Hero earnings */}
                            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View>
                                    <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Total Earned</Text>
                                    <Text style={[styles.heroAmount, { color: colors.text }]}>
                                        {dash ?? fmt(stats?.totalEarned ?? 0)}
                                    </Text>
                                    <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                                        from {stats?.tasksCompleted ?? 0} completed task{stats?.tasksCompleted !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                                <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
                                    <Ionicons name="wallet" size={32} color="#F5A623" />
                                </View>
                            </View>

                            {/* Rank progress */}
                            <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.progressTitle, { color: colors.text }]}>
                                    {nextRankInfo
                                        ? `${nextRankInfo.remaining} more task${nextRankInfo.remaining !== 1 ? 's' : ''} to reach `
                                        : "You've reached the top! "}
                                    <Text style={{ color: nextRankInfo ? nextRankInfo.rank.color : rank.color }}>
                                        {nextRankInfo ? `${nextRankInfo.rank.emoji} ${nextRankInfo.rank.label}` : '👑 Legend'}
                                    </Text>
                                </Text>
                                <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
                                    <Animated.View
                                        style={[styles.progressFill, {
                                            backgroundColor: nextRankInfo ? nextRankInfo.rank.color : rank.color,
                                            width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                                        }]}
                                    />
                                </View>
                            </View>

                            {/* 2×2 pill grid */}
                            <View style={styles.pillGrid}>
                                <StatPill icon="checkmark-done-circle" value={dash ?? (stats?.tasksCompleted ?? 0)} label="Completed" accentColor="#4CAF50" colors={colors} />
                                <StatPill icon="construct" value={dash ?? (stats?.tasksActive ?? 0)} label="Active Now" accentColor="#FF9500" colors={colors} />
                                <StatPill icon="paper-plane-outline" value={dash ?? (stats?.applicationsTotal ?? 0)} label="Applied" accentColor={colors.accent} colors={colors} />
                                <StatPill icon="trending-up" value={dash ?? (acceptanceRate !== null ? `${acceptanceRate}%` : 'N/A')} label="Success Rate" accentColor="#BF5AF2" colors={colors} />
                            </View>

                            {/* Applications context */}
                            {!statsLoading && (stats?.applicationsTotal ?? 0) > 0 && (
                                <View style={[styles.footerBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                                        Applied to{' '}
                                        <Text style={{ color: colors.text, fontFamily: FontFamily.bold }}>{stats?.applicationsTotal}</Text>
                                        {' '}tasks —{' '}
                                        <Text style={{ color: '#4CAF50', fontFamily: FontFamily.semiBold }}>{stats?.applicationsAccepted} accepted</Text>
                                    </Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* ── POSTER VIEW ── */}
                    {statsMode === 'poster' && (
                        <>
                            {/* Hero: money spent */}
                            <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View>
                                    <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Total Spent</Text>
                                    <Text style={[styles.heroAmount, { color: colors.text }]}>
                                        {dash ?? fmt(stats?.totalSpent ?? 0)}
                                    </Text>
                                    <Text style={[styles.heroSub, { color: colors.textMuted }]}>
                                        across {stats?.postsCompleted ?? 0} completed post{stats?.postsCompleted !== 1 ? 's' : ''}
                                    </Text>
                                </View>
                                <View style={[styles.heroIcon, { backgroundColor: colors.surface }]}>
                                    <Ionicons name="cash-outline" size={32} color="#4CAF50" />
                                </View>
                            </View>

                            {/* 2×2 pill grid */}
                            <View style={styles.pillGrid}>
                                <StatPill icon="add-circle-outline" value={dash ?? (stats?.postsTotal ?? 0)} label="Total Posts" accentColor={colors.accent} colors={colors} />
                                <StatPill icon="people-outline" value={dash ?? (stats?.helpersHired ?? 0)} label="Helpers Hired" accentColor="#4CAF50" colors={colors} />
                                <StatPill icon="radio-button-on-outline" value={dash ?? (stats?.postsOpen ?? 0)} label="Open Now" accentColor="#4D9FFF" colors={colors} />
                                <StatPill icon="construct-outline" value={dash ?? (stats?.postsInProgress ?? 0)} label="In Progress" accentColor="#FF9500" colors={colors} />
                            </View>

                            {/* Milestone / encouragement */}
                            {!statsLoading && (
                                <View style={[styles.footerBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Ionicons name="megaphone-outline" size={16} color={colors.textMuted} />
                                    <Text style={[styles.footerText, { color: colors.textSecondary }]}>
                                        {(stats?.postsTotal ?? 0) === 0
                                            ? 'Post your first task and find a helper today!'
                                            : `You've posted ${stats?.postsTotal} task${stats?.postsTotal !== 1 ? 's' : ''} — keep it up! 🎉`
                                        }
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            <NotificationSheet
                visible={notifVisible}
                onClose={() => {
                    setNotifVisible(false);
                    if (user?.id) {
                        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(user.id) });
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

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, marginBottom: Spacing.xl,
    },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { fontSize: FontSize.lg, fontFamily: FontFamily.bold },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    badge: {
        position: 'absolute', top: 4, right: 2, minWidth: 18, height: 18,
        borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
    },
    badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: FontFamily.bold, lineHeight: 14 },
    logo: { width: 32, height: 32 },

    // Scroll
    content: { flex: 1, paddingHorizontal: Spacing.xl },
    scrollContent: { flexGrow: 1, paddingBottom: Spacing.huge },

    // Welcome
    welcomeSection: { marginBottom: Spacing.xl + Spacing.md },
    welcomeText: { fontSize: FontSize.xl, fontFamily: FontFamily.regular, marginBottom: 4 },
    nameText: { fontSize: FontSize.xxxl, fontFamily: FontFamily.bold, marginBottom: Spacing.sm },
    taglineText: { fontSize: FontSize.md, fontFamily: FontFamily.regular },

    // Action Cards
    cardsContainer: { gap: Spacing.md },
    card: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
        borderRadius: BorderRadius.xl, gap: Spacing.lg,
    },
    iconBox: { width: 52, height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: FontSize.lg, fontFamily: FontFamily.bold, marginBottom: 2 },
    cardSubtitle: { fontSize: FontSize.sm, fontFamily: FontFamily.regular },

    // Stats section
    statsSection: { gap: Spacing.md },
    statsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.bold },

    // Rank badge
    rankBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: Spacing.md, paddingVertical: 5,
        borderRadius: BorderRadius.full, borderWidth: 1,
    },
    rankEmoji: { fontSize: 14 },
    rankLabel: { fontSize: FontSize.sm, fontFamily: FontFamily.bold },

    // Mode toggle
    modeToggle: {
        flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1,
        padding: 3, gap: 3,
    },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 5, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    },
    modeBtnText: { fontSize: FontSize.sm, fontFamily: FontFamily.semiBold },

    // Hero card
    heroCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg,
    },
    heroLabel: { fontSize: FontSize.sm, fontFamily: FontFamily.medium },
    heroAmount: { fontSize: 36, fontFamily: FontFamily.bold, letterSpacing: -1 },
    heroSub: { fontSize: FontSize.xs, fontFamily: FontFamily.regular },
    heroIcon: { width: 60, height: 60, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },

    // Rank progress
    progressCard: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
    progressTitle: { fontSize: FontSize.sm, fontFamily: FontFamily.medium, lineHeight: 20 },
    progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },

    // Pill grid
    pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    statPill: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md,
        width: (SCREEN_W - Spacing.xl * 2 - Spacing.sm) / 2,
    },
    statPillIcon: { width: 34, height: 34, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
    statPillValue: { fontSize: FontSize.xl, fontFamily: FontFamily.bold },
    statPillLabel: { fontSize: FontSize.xs, fontFamily: FontFamily.medium },

    // Footer info bar
    footerBar: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md,
    },
    footerText: { fontSize: FontSize.sm, fontFamily: FontFamily.regular, flex: 1, lineHeight: 20 },
});
