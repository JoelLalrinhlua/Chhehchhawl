/**
 * (tabs)/history.tsx — My Posts / My Tasks dual-tab screen.
 *
 * “My Posts” shows tasks the current user created (with applicant counts).
 * “My Tasks” shows tasks assigned to the current user.
 * Tapping a card opens TaskDetailSheet; the poster can also view applicants
 * via ApplicantListSheet.
 */

import { ApplicantListSheet } from '@/components/ApplicantListSheet';
import { EditTaskSheet } from '@/components/EditTaskSheet';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useApplications } from '@/contexts/ApplicationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, type Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFinishTaskMutation, useMarkPaymentSentMutation } from '@/hooks/use-mutations';
import { useMyAppliedTasksQuery, type AppliedTask } from '@/hooks/use-task-queries';
import { useToast } from '@/contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TABS = ['My Tasks', 'My Posts'];

export default function MyTasksScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { showToast } = useToast();
    const router = useRouter();
    const { getMyPosts, getMyTasks, refreshTasks, deleteTask } = useTasks();
    const { applicantCounts, refreshApplicantCounts, myApplications } = useApplications();
    const [activeTab, setActiveTab] = useState(0);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedPostTask, setSelectedPostTask] = useState<Task | null>(null);
    const [applicantSheetTask, setApplicantSheetTask] = useState<Task | null>(null);
    const pagerRef = useRef<Animated.LegacyRef<any>>(null);
    // scrollX drives the indicator and tab labels in real-time via native thread
    const scrollX = useRef(new Animated.Value(0)).current;

    const finishTaskMutation = useFinishTaskMutation(user?.id);
    const markPaymentSentMutation = useMarkPaymentSentMutation(user?.id);

    const myPosts = getMyPosts(user?.id || '');
    const myTasks = getMyTasks(user?.id || '');

    // Applied tasks (pending / rejected, not yet assigned to user)
    const { data: appliedTasks = [] } = useMyAppliedTasksQuery(
        !!user,
        user?.id,
        myApplications
    );

    // Unified My Tasks list: assigned tasks + applied tasks
    type MyTaskItem =
        | (Task & { _kind: 'assigned' })
        | (AppliedTask & { _kind: 'applied' });

    const unifiedMyTasks = useMemo<MyTaskItem[]>(() => {
        const assigned: MyTaskItem[] = myTasks.map((t) => ({ ...t, _kind: 'assigned' as const }));
        const applied = appliedTasks.map((t) => ({ ...t, _kind: 'applied' as const }));
        // Applied-pending first, then assigned tasks, then applied-rejected at end
        const pending = applied.filter((t) => t.applicationStatus === 'pending');
        const rejected = applied.filter((t) => t.applicationStatus === 'rejected');
        return [...pending, ...assigned, ...rejected];
    }, [myTasks, appliedTasks]);

    // Fetch applicant counts when viewing My Posts
    useEffect(() => {
        if (activeTab === 1 && myPosts.length > 0) {
            refreshApplicantCounts(myPosts.map((t) => t.id));
        }
    }, [activeTab, myPosts.length]);

    // Handle tasker finishing a task (My Tasks)
    const handleFinishTask = useCallback(async (taskId: string) => {
        try {
            await finishTaskMutation.mutateAsync({ taskId });
            refreshTasks();
            setSelectedTask(null);
        } catch (err: any) {
            showToast(err.message ?? 'Failed to finish task', 'error');
            throw err;
        }
    }, [finishTaskMutation, refreshTasks]);

    // Handle poster marking payment as sent (My Posts — from task detail)
    const handleConfirmCompletion = useCallback(async (taskId: string) => {
        try {
            await markPaymentSentMutation.mutateAsync({ taskId });
            refreshTasks();
            setSelectedPostTask(null);
        } catch (err: any) {
            showToast(err.message ?? 'Failed to mark payment sent', 'error');
            throw err;
        }
    }, [markPaymentSentMutation, refreshTasks]);

    // Handle task deletion from My Posts
    const handleDeleteTask = useCallback(async (taskId: string) => {
        const result = await deleteTask(taskId);
        if (result.error) {
            showToast(result.error, 'error');
            throw new Error(result.error);
        }
        setSelectedPostTask(null);
        refreshApplicantCounts(myPosts.filter(t => t.id !== taskId).map(t => t.id));
    }, [deleteTask, myPosts, refreshApplicantCounts]);

    // Handle poster accepting a tasker — navigate directly to chat room
    const handleAcceptSuccess = useCallback((roomId: string) => {
        setApplicantSheetTask(null);
        setSelectedPostTask(null);
        refreshTasks();
        // Navigate to chat tab with the specific room
        router.push({ pathname: '/(tabs)/chat', params: { openRoomId: roomId } });
    }, [router, refreshTasks]);

    // Indicator translateX interpolated directly from scroll position (native thread, 60fps)
    const indicatorTranslateX = scrollX.interpolate({
        inputRange: [0, SCREEN_WIDTH],
        outputRange: [0, (SCREEN_WIDTH - Spacing.xl * 2) / 2],
        extrapolate: 'clamp',
    });

    // Tab 0 opacity: full when at x=0, fades as we scroll right
    const tab0Opacity = scrollX.interpolate({
        inputRange: [0, SCREEN_WIDTH],
        outputRange: [1, 0.45],
        extrapolate: 'clamp',
    });
    // Tab 1 opacity: fades in as we scroll right
    const tab1Opacity = scrollX.interpolate({
        inputRange: [0, SCREEN_WIDTH],
        outputRange: [0.45, 1],
        extrapolate: 'clamp',
    });

    const switchTab = (index: number) => {
        setActiveTab(index);
        (pagerRef.current as any)?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const handleSwipe = (x: number) => {
        const index = Math.round(x / SCREEN_WIDTH);
        if (index !== activeTab) {
            setActiveTab(index);
        }
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
                case 'payment_pending':
                    return { label: 'Payment Pending', color: colors.statusOrange, icon: 'wallet' as const };
                case 'payment_sent':
                    return { label: 'Payment Sent', color: colors.statusGreen, icon: 'card' as const };
                case 'completed':
                    return { label: 'Completed', color: colors.textMuted, icon: 'checkmark-circle' as const };
                case 'pending_confirmation':
                    return { label: 'Pending Confirmation', color: colors.statusOrange, icon: 'hourglass' as const };
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
            <View>
                <Pressable
                    style={[
                        styles.postCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedPostTask(item)}
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

                        <Pressable
                            style={[
                                styles.applicantBadge,
                                {
                                    marginTop: Spacing.sm,
                                    justifyContent: 'space-between',
                                    borderRadius: BorderRadius.md,
                                    paddingVertical: Spacing.sm,
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
                                <Ionicons
                                    name="people"
                                    size={16}
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
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color={colors.textMuted}
                            />
                        </Pressable>


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
            </View>
        );
    };

    // ── My Tasks: standard card grid ──
    const renderMyTaskCard = ({ item }: { item: Task }) => (
        <View style={{ flex: 1, maxWidth: '50%' }}>
            <TaskCard task={item} onPress={setSelectedTask} />
        </View>
    );

    // ── Application status config ──
    const getAppStatusConfig = useCallback(
        (appStatus: any) => {
            if (appStatus === 'pending') {
                return { label: 'Pending', color: colors.statusOrange, icon: 'time' as const };
            }
            return { label: 'Not Selected', color: colors.statusRed, icon: 'close-circle' as const };
        },
        [colors]
    );

    // ── Unified My Tasks item (assigned tasks + applied tasks) ──
    const renderMyTaskItem = ({ item }: { item: typeof unifiedMyTasks[number] }) => {
        const isApplied = item._kind === 'applied';
        const statusCfg = isApplied
            ? getAppStatusConfig(item.applicationStatus)
            : getStatusConfig(item.status);

        return (
            <Pressable
                style={[
                    styles.postCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setSelectedTask(item)}
            >
                <View
                    style={[
                        styles.postStatusStrip,
                        { backgroundColor: statusCfg.color },
                    ]}
                />
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
                    <View style={[styles.postBottomRow, { justifyContent: 'flex-end' }]}>
                        {isApplied && (
                            <Text
                                style={[
                                    styles.postTime,
                                    { color: colors.textMuted, fontFamily: FontFamily.regular },
                                ]}
                            >
                                Applied
                            </Text>
                        )}
                    </View>
                    <Text
                        style={[
                            styles.postTime,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        {formatDate(item.created_at)}
                    </Text>
                </View>
            </Pressable>
        );
    };

    const renderEmptyTasks = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                No tasks or applications yet
            </Text>
        </View>
    );

    const renderEmptyPosts = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="create-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                You haven&apos;t posted any tasks yet
            </Text>
        </View>
    );

    return (
        <SafeAreaView
            style={[styles.container, { backgroundColor: colors.background }]}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text
                    style={[
                        styles.headerTitle,
                        { color: colors.text, fontFamily: FontFamily.bold },
                    ]}
                >
                    Task History
                </Text>
            </View>

            {/* Tab Bar */}
            <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                {TABS.map((tab, index) => (
                    <Pressable
                        key={tab}
                        style={styles.tabButton}
                        onPress={() => switchTab(index)}
                    >
                        <Animated.Text
                            style={[
                                styles.tabText,
                                {
                                    color: colors.accent,
                                    fontFamily: activeTab === index ? FontFamily.bold : FontFamily.regular,
                                    opacity: index === 0 ? tab0Opacity : tab1Opacity,
                                },
                            ]}
                        >
                            {tab}
                        </Animated.Text>
                    </Pressable>
                ))}
                <Animated.View
                    style={[
                        styles.tabIndicator,
                        {
                            backgroundColor: colors.accent,
                            width: (SCREEN_WIDTH - Spacing.xl * 2) / 2,
                            transform: [{ translateX: indicatorTranslateX }],
                        },
                    ]}
                />
            </View>

            {/* Content */}
            {/* Swipeable content pager — Animated.ScrollView for native-thread scroll tracking */}
            <Animated.ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={1}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                onMomentumScrollEnd={(e) => handleSwipe(e.nativeEvent.contentOffset.x)}
                style={{ flex: 1 }}
                decelerationRate="fast"
            >
                {/* Page 0 — My Tasks */}
                <FlatList
                    key="my-tasks-list"
                    data={unifiedMyTasks}
                    renderItem={renderMyTaskItem}
                    keyExtractor={(item) => item.id + item._kind}
                    contentContainerStyle={[styles.listContent, { width: SCREEN_WIDTH }]}
                    style={{ width: SCREEN_WIDTH }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmptyTasks}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: Spacing.sm }} />
                    )}
                />

                {/* Page 1 — My Posts */}
                <FlatList
                    key="my-posts-list"
                    data={myPosts}
                    renderItem={renderMyPostItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[styles.listContent, { width: SCREEN_WIDTH }]}
                    style={{ width: SCREEN_WIDTH }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={renderEmptyPosts}
                    ItemSeparatorComponent={() => (
                        <View style={{ height: Spacing.sm }} />
                    )}
                />
            </Animated.ScrollView>

            {/* Task Detail Sheet (for My Posts) */}
            {selectedPostTask && (
                <TaskDetailSheet
                    task={selectedPostTask}
                    visible={!!selectedPostTask}
                    onClose={() => setSelectedPostTask(null)}
                    onDelete={handleDeleteTask}
                    onConfirmCompletion={handleConfirmCompletion}
                />
            )}

            {/* Task Detail Sheet (for My Tasks cards) */}
            {selectedTask && (
                <TaskDetailSheet
                    task={selectedTask}
                    visible={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onFinishTask={handleFinishTask}
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
                    onAcceptSuccess={handleAcceptSuccess}
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
