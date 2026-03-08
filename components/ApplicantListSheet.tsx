/**
 * ApplicantListSheet.tsx — Bottom-sheet that lists applicants for a task.
 *
 * Visible only to the task poster. Each row shows the applicant’s username,
 * status, and optional message. The poster can accept or reject applicants
 * via confirmation dialogs, triggering TanStack mutations.
 *
 * Dismissal uses a pan-down gesture on the handle.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import {
    useApplications,
    type TaskApplicant,
} from '@/contexts/ApplicationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ApplicantListSheetProps {
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    isMyPost: boolean;
    visible: boolean;
    onClose: () => void;
    onStatusChange?: () => void;
}

export function ApplicantListSheet({
    taskId,
    taskTitle,
    taskStatus,
    isMyPost,
    visible,
    onClose,
    onStatusChange,
}: ApplicantListSheetProps) {
    const { colors } = useTheme();
    const { getTaskApplicants, acceptApplicant, rejectApplicant } =
        useApplications();
    const [applicants, setApplicants] = useState<TaskApplicant[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const translateY = useSharedValue(0);

    const fetchApplicants = useCallback(async () => {
        setLoading(true);
        const data = await getTaskApplicants(taskId);
        setApplicants(data);
        setLoading(false);
    }, [taskId, getTaskApplicants]);

    useEffect(() => {
        if (visible) {
            translateY.value = 0;
            fetchApplicants();
        }
    }, [visible, fetchApplicants]);

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (e.translationY > 120) {
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
                runOnJS(onClose)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const handleAccept = (applicant: TaskApplicant) => {
        Alert.alert(
            'Accept Applicant',
            `Accept ${applicant.full_name ?? applicant.username ?? 'this user'} for "${taskTitle}"?\n\nThis will assign the task and stop accepting new applications.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    style: 'default',
                    onPress: async () => {
                        setActionLoading(applicant.applicant_id);
                        const result = await acceptApplicant(
                            taskId,
                            applicant.applicant_id
                        );
                        setActionLoading(null);
                        if (result.success) {
                            Alert.alert('Done', 'Tasker accepted successfully!');
                            onStatusChange?.();
                            fetchApplicants();
                        } else {
                            Alert.alert('Error', result.error ?? 'Failed to accept');
                        }
                    },
                },
            ]
        );
    };

    const handleReject = (applicant: TaskApplicant) => {
        Alert.alert(
            'Reject Applicant',
            `Reject ${applicant.full_name ?? applicant.username ?? 'this user'}?\n\nThis user will be permanently blocked from reapplying to this task.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(applicant.applicant_id);
                        const result = await rejectApplicant(
                            taskId,
                            applicant.applicant_id
                        );
                        setActionLoading(null);
                        if (result.success) {
                            fetchApplicants();
                        } else {
                            Alert.alert('Error', result.error ?? 'Failed to reject');
                        }
                    },
                },
            ]
        );
    };

    const renderApplicant = ({
        item,
        index,
    }: {
        item: TaskApplicant;
        index: number;
    }) => {
        const isAccepted = item.status === 'accepted';
        const isActionable = isMyPost && taskStatus === 'open' && item.status === 'pending';
        const isProcessing = actionLoading === item.applicant_id;

        return (
            <Animated.View
                entering={FadeInDown.duration(300).delay(index * 60)}
                style={[
                    styles.applicantCard,
                    {
                        backgroundColor: isAccepted
                            ? colors.statusGreen + '15'
                            : colors.card,
                        borderColor: isAccepted ? colors.statusGreen + '40' : colors.border,
                    },
                ]}
            >
                {/* Avatar placeholder */}
                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: isAccepted
                                ? colors.statusGreen + '30'
                                : colors.accentLight,
                        },
                    ]}
                >
                    <Text style={[styles.avatarText, { color: isAccepted ? colors.statusGreen : colors.accent }]}>
                        {(item.full_name ?? item.username ?? '?').charAt(0).toUpperCase()}
                    </Text>
                </View>

                {/* Info */}
                <View style={styles.applicantInfo}>
                    <View style={styles.nameRow}>
                        <Text
                            style={[
                                styles.applicantName,
                                { color: colors.text, fontFamily: FontFamily.semiBold },
                            ]}
                            numberOfLines={1}
                        >
                            {item.full_name ?? item.username ?? 'Anonymous'}
                        </Text>
                        {isAccepted && (
                            <View
                                style={[
                                    styles.acceptedBadge,
                                    { backgroundColor: colors.statusGreen + '20' },
                                ]}
                            >
                                <Ionicons
                                    name="checkmark-circle"
                                    size={14}
                                    color={colors.statusGreen}
                                />
                                <Text
                                    style={[
                                        styles.acceptedText,
                                        {
                                            color: colors.statusGreen,
                                            fontFamily: FontFamily.medium,
                                        },
                                    ]}
                                >
                                    Accepted
                                </Text>
                            </View>
                        )}
                    </View>

                    {item.username && (
                        <Text
                            style={[
                                styles.username,
                                { color: colors.textMuted, fontFamily: FontFamily.regular },
                            ]}
                        >
                            @{item.username}
                        </Text>
                    )}

                    {item.message && (
                        <Text
                            style={[
                                styles.message,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                            numberOfLines={2}
                        >
                            "{item.message}"
                        </Text>
                    )}

                    {item.bio && (
                        <Text
                            style={[
                                styles.bio,
                                {
                                    color: colors.textMuted,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {item.bio}
                        </Text>
                    )}

                    <Text
                        style={[
                            styles.appliedTime,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        Applied {formatTimeAgo(item.applied_at)}
                    </Text>
                </View>

                {/* Action Buttons */}
                {isActionable && !isProcessing && (
                    <View style={styles.actionButtons}>
                        <Pressable
                            style={[
                                styles.actionBtn,
                                { backgroundColor: colors.statusGreen + '20' },
                            ]}
                            onPress={() => handleAccept(item)}
                        >
                            <Ionicons
                                name="checkmark"
                                size={20}
                                color={colors.statusGreen}
                            />
                        </Pressable>
                        <Pressable
                            style={[
                                styles.actionBtn,
                                { backgroundColor: colors.statusRed + '20' },
                            ]}
                            onPress={() => handleReject(item)}
                        >
                            <Ionicons
                                name="close"
                                size={20}
                                color={colors.statusRed}
                            />
                        </Pressable>
                    </View>
                )}

                {isProcessing && (
                    <ActivityIndicator size="small" color={colors.accent} />
                )}
            </Animated.View>
        );
    };

    if (!visible) return null;

    return (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
            >
              <GestureDetector gesture={panGesture}>
                <Animated.View
                    style={[
                        styles.sheet,
                        { backgroundColor: colors.surface },
                        sheetStyle,
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />

                    {/* Header */}
                    <View
                        style={styles.sheetHeader}
                    >
                        <Text
                            style={[
                                styles.sheetTitle,
                                { color: colors.text, fontFamily: FontFamily.bold },
                            ]}
                        >
                            Applicants
                        </Text>
                        <Text
                            style={[
                                styles.sheetSubtitle,
                                {
                                    color: colors.textSecondary,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {taskTitle}
                        </Text>
                        {taskStatus === 'assigned' && (
                            <View
                                style={[
                                    styles.assignedBanner,
                                    { backgroundColor: colors.statusGreen + '15' },
                                ]}
                            >
                                <Ionicons
                                    name="checkmark-circle"
                                    size={16}
                                    color={colors.statusGreen}
                                />
                                <Text
                                    style={[
                                        styles.assignedBannerText,
                                        {
                                            color: colors.statusGreen,
                                            fontFamily: FontFamily.medium,
                                        },
                                    ]}
                                >
                                    Task has been assigned
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* List */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.accent} />
                        </View>
                    ) : applicants.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name="people-outline"
                                size={48}
                                color={colors.textMuted}
                            />
                            <Text
                                style={[
                                    styles.emptyText,
                                    {
                                        color: colors.textMuted,
                                        fontFamily: FontFamily.regular,
                                    },
                                ]}
                            >
                                No applicants yet
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={applicants}
                            renderItem={renderApplicant}
                            keyExtractor={(item) => item.application_id}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            ItemSeparatorComponent={() => (
                                <View style={{ height: Spacing.sm }} />
                            )}
                        />
                    )}
                </Animated.View>
              </GestureDetector>
            </Animated.View>
        </View>
    );
}

// ── Helper ──────────────────────────────────────────────────────
function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        height: SCREEN_HEIGHT * 0.77,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        paddingTop: Spacing.md,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    sheetHeader: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    sheetTitle: {
        fontSize: FontSize.xxl,
    },
    sheetSubtitle: {
        fontSize: FontSize.sm,
        marginTop: Spacing.xs,
    },
    assignedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
    },
    assignedBannerText: {
        fontSize: FontSize.sm,
    },
    loadingContainer: {
        paddingVertical: Spacing.huge * 2,
        alignItems: 'center',
    },
    emptyContainer: {
        paddingVertical: Spacing.huge * 2,
        alignItems: 'center',
        gap: Spacing.md,
    },
    emptyText: {
        fontSize: FontSize.md,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.huge,
    },
    applicantCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.md,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.bold,
    },
    applicantInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    applicantName: {
        fontSize: FontSize.md,
        flexShrink: 1,
    },
    username: {
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    message: {
        fontSize: FontSize.sm,
        marginTop: Spacing.xs,
        fontStyle: 'italic',
    },
    bio: {
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    appliedTime: {
        fontSize: FontSize.xs,
        marginTop: Spacing.xs,
    },
    acceptedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
        gap: 4,
    },
    acceptedText: {
        fontSize: FontSize.xs,
    },
    actionButtons: {
        gap: Spacing.sm,
    },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
