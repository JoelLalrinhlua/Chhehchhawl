/**
 * (tabs)/history.tsx — My Posts / My Tasks dual-tab screen.
 *
 * “My Posts” shows tasks the current user created (with applicant counts).
 * “My Tasks” shows tasks assigned to the current user.
 * Tapping a card opens TaskDetailSheet; the poster can also view applicants
 * via ApplicantListSheet.
 */

import { ApplicantListSheet } from '@/components/ApplicantListSheet';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useApplications } from '@/contexts/ApplicationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, type Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['My Posts', 'My Tasks'];

export default function MyTasksScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { getMyPosts, getMyTasks, refreshTasks } = useTasks();
    const { applicantCounts, refreshApplicantCounts } = useApplications();
    const [activeTab, setActiveTab] = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [applicantSheetTask, setApplicantSheetTask] = useState<Task | null>(null);
    const tabIndicatorX = useSharedValue(0);

    const myPosts = getMyPosts(user?.id || '');
    const myTasks = getMyTasks(user?.id || '');

    // Fetch applicant counts when viewing My Posts
    useEffect(() => {
        if (activeTab === 0 && myPosts.length > 0) {
            refreshApplicantCounts(myPosts.map((t) => t.id));
        }
    }, [activeTab, myPosts.length]);

    const indicatorStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: tabIndicatorX.value }],
    }));

    const switchTab = (index: number) => {
        setActiveTab(index);
        tabIndicatorX.value = withTiming(
            (index * (SCREEN_WIDTH - Spacing.xl * 2)) / 2,
            { duration: 300 }
        );
    };

    const getStatusConfig = useCallback(
        (status: Task['status']) => {
            switch (status) {
                case 'open':
                    return { label: 'Open', color: colors.statusGreen, icon: 'radio-button-on' as const };
                case 'assigned':
                    return { label: 'Assigned', color: colors.statusOrange, icon: 'person' as const };
                case 'in-progress':
                    return { label: 'In Progress', color: colors.statusOrange, icon: 'time' as const };
                case 'completed':
                    return { label: 'Completed', color: colors.textMuted, icon: 'checkmark-circle' as const };
                case 'cancelled':
                    return { label: 'Cancelled', color: colors.statusRed, icon: 'close-circle' as const };
                default:
                    return { label: status, color: colors.textMuted, icon: 'ellipse' as const };
            }
        },
        [colors]
    );

    // ── My Posts: structured list with applicant counts ──
    const renderMyPostItem = ({ item, index }: { item: Task; index: number }) => {
        const count = applicantCounts[item.id] ?? 0;
        const statusCfg = getStatusConfig(item.status);

        return (
            <Animated.View entering={FadeInDown.duration(300).delay(index * 60)}>
                <Pressable
                    style={[
                        styles.postCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => setApplicantSheetTask(item)}
                >
                    {/* Left: status indicator */}
                    <View
                        style={[
                            styles.postStatusStrip,
                            { backgroundColor: statusCfg.color },
                        ]}
                    />

                    {/* Content */}
                    <View style={styles.postContent}>
                        <View style={styles.postTopRow}>
                            <Text
                                style={[
                                    styles.postTitle,
                                    { color: colors.text, fontFamily: FontFamily.semiBold },
                                ]}
                                numberOfLines={1}
                            >
                                {item.title}
                            </Text>
                            <View
                                style={[
                                    styles.statusChip,
                                    { backgroundColor: statusCfg.color + '18' },
                                ]}
                            >
                                <Ionicons
                                    name={statusCfg.icon}
                                    size={12}
                                    color={statusCfg.color}
                                />
                                <Text
                                    style={[
                                        styles.statusChipText,
                                        {
                                            color: statusCfg.color,
                                            fontFamily: FontFamily.medium,
                                        },
                                    ]}
                                >
                                    {statusCfg.label}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.postBottomRow}>
                            <Text
                                style={[
                                    styles.postBudget,
                                    { color: colors.accent, fontFamily: FontFamily.bold },
                                ]}
                            >
                                ₹{item.budget}
                            </Text>

                            <Pressable
                                style={[
                                    styles.applicantBadge,
                                    {
                                        backgroundColor:
                                            count > 0
                                                ? colors.accent + '15'
                                                : colors.card,
                                        borderColor:
                                            count > 0
                                                ? colors.accent + '30'
                                                : colors.border,
                                    },
                                ]}
                                onPress={() => setApplicantSheetTask(item)}
                            >
                                <Ionicons
                                    name="people"
                                    size={14}
                                    color={
                                        count > 0
                                            ? colors.accent
                                            : colors.textMuted
                                    }
                                />
                                <Text
                                    style={[
                                        styles.applicantCount,
                                        {
                                            color:
                                                count > 0
                                                    ? colors.accent
                                                    : colors.textMuted,
                                            fontFamily: FontFamily.bold,
                                        },
                                    ]}
                                >
                                    {count} {count === 1 ? 'Applicant' : 'Applicants'}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={14}
                                    color={colors.textMuted}
                                />
                            </Pressable>
                        </View>

                        <Text
                            style={[
                                styles.postTime,
                                {
                                    color: colors.textMuted,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                        >
                            {formatDate(item.created_at)}
                        </Text>
                    </View>
                </Pressable>
            </Animated.View>
        );
    };

    // ── My Tasks: standard card grid ──
    const renderMyTaskCard = ({ item }: { item: Task }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
            <TaskCard task={item} onPress={setSelectedTask} />
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Ionicons
                name={activeTab === 0 ? 'create-outline' : 'briefcase-outline'}
                size={48}
                color={colors.textMuted}
            />
            <Text
                style={[
                    styles.emptyText,
                    { color: colors.textMuted, fontFamily: FontFamily.regular },
                ]}
            >
                {activeTab === 0
                    ? "You haven't posted any tasks yet"
                    : 'No tasks assigned to you yet'}
            </Text>
        </View>
    );

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            {/* Header */}
            <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
                <Text
                    style={[
                        styles.headerTitle,
                        { color: colors.text, fontFamily: FontFamily.bold },
                    ]}
                >
                    Task History
                </Text>
            </Animated.View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                {TABS.map((tab, index) => (
                    <Pressable
                        key={tab}
                        style={styles.tabButton}
                        onPress={() => switchTab(index)}
                    >
                        <Text
                            style={[
                                styles.tabText,
                                {
                                    color:
                                        activeTab === index
                                            ? colors.accent
                                            : colors.textMuted,
                                    fontFamily:
                                        activeTab === index
                                            ? FontFamily.bold
                                            : FontFamily.regular,
                                },
                            ]}
                        >
                            {tab}
                        </Text>
                    </Pressable>
                ))}
                <Animated.View
                    style={[
                        styles.tabIndicator,
                        {
                            backgroundColor: colors.accent,
                            width: (SCREEN_WIDTH - Spacing.xl * 2) / 2,
                        },
                        indicatorStyle,
                    ]}
                />
            </View>

            {/* Content */}
            {activeTab === 0 ? (
                // My Posts — structured list
                <FlatList
                    key="my-posts-list"
                    data={myPosts}
                    renderItem={renderMyPostItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: Spacing.sm }} />
                    )}
                />
            ) : (
                // My Tasks — card grid
                <FlatList
                    key="my-tasks-grid"
                    data={myTasks}
                    renderItem={renderMyTaskCard}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmpty}
                    columnWrapperStyle={
                        myTasks.length > 0 ? styles.row : undefined
                    }
                />
            )}

            {/* Task Detail Sheet (for My Tasks cards) */}
            {selectedTask && (
                <TaskDetailSheet
                    task={selectedTask}
                    visible={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                />
            )}

            {/* Applicant List Sheet (for My Posts) */}
            {applicantSheetTask && (
                <ApplicantListSheet
                    taskId={applicantSheetTask.id}
                    taskTitle={applicantSheetTask.title}
                    taskStatus={applicantSheetTask.status}
                    isMyPost={true}
                    visible={!!applicantSheetTask}
                    onClose={() => setApplicantSheetTask(null)}
                    onStatusChange={() => {
                        refreshTasks();
                        refreshApplicantCounts(myPosts.map((t) => t.id));
                    }}
                />
            )}
        </SafeAreaView>
    );
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
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
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    headerTitle: {
        fontSize: FontSize.xxxl,
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: Spacing.xl,
        borderBottomWidth: 1,
        position: 'relative',
    },
    tabButton: {
        flex: 1,
        paddingVertical: Spacing.md,
        alignItems: 'center',
    },
    tabText: {
        fontSize: FontSize.md,
    },
    tabIndicator: {
        position: 'absolute',
        bottom: -1,
        height: 3,
        borderRadius: 1.5,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.huge,
        flexGrow: 1,
    },
    grid: {
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.huge,
        flexGrow: 1,
    },
    row: {
        justifyContent: 'space-between',
    },
    // ── My Post Card ──
    postCard: {
        flexDirection: 'row',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    postStatusStrip: {
        width: 4,
    },
    postContent: {
        flex: 1,
        padding: Spacing.lg,
    },
    postTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    postTitle: {
        fontSize: FontSize.md,
        flex: 1,
        marginRight: Spacing.sm,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
    },
    statusChipText: {
        fontSize: FontSize.xs,
    },
    postBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xs,
    },
    postBudget: {
        fontSize: FontSize.lg,
    },
    applicantBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    applicantCount: {
        fontSize: FontSize.sm,
    },
    postTime: {
        fontSize: FontSize.xs,
    },
    // ── Empty ──
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: Spacing.huge * 2,
        gap: Spacing.md,
    },
    emptyText: {
        fontSize: FontSize.md,
        textAlign: 'center',
    },
});
