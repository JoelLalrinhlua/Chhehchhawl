/**
 * ApplicantListSheet.tsx — Bottom-sheet that lists applicants for a task.
 *
 * Visible only to the task poster. Each row shows the applicant’s username,
 * status, and optional message. The poster can accept or reject applicants
 * via confirmation dialogs, triggering TanStack mutations.
 *
 * Dismissal uses a pan-down gesture on the handle.
 */

import { CustomAlert, type AlertButton } from '@/components/CustomAlert';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import {
    useApplications,
    type TaskApplicant,
} from '@/contexts/ApplicationContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Modal,
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
    /** Called after a tasker is successfully accepted, with the chat room ID */
    onAcceptSuccess?: (roomId: string) => void;
}

export function ApplicantListSheet({
    taskId,
    taskTitle,
    taskStatus,
    isMyPost,
    visible,
    onClose,
    onStatusChange,
    onAcceptSuccess,
}: ApplicantListSheetProps) {
    const { colors } = useTheme();
    const { showToast } = useToast();
    const router = useRouter();
    const { getTaskApplicants, acceptApplicant, rejectApplicant } =
        useApplications();
    const [applicants, setApplicants] = useState<TaskApplicant[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [selectedApplicant, setSelectedApplicant] = useState<TaskApplicant | null>(null);
    const translateY = useSharedValue(0);
    // Custom alert state
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        variant: 'confirm' | 'destructive';
        buttons: AlertButton[];
    }>({ visible: false, title: '', message: '', variant: 'confirm', buttons: [] });
    const closeAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

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
        const name = applicant.full_name ?? applicant.username ?? 'this user';
        setAlertConfig({
            visible: true,
            title: 'Accept Applicant',
            message: `Accept ${name} for "${taskTitle}"?\n\nThis will assign the task and open a chat with them.`,
            variant: 'confirm',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    style: 'default',
                    onPress: async () => {
                        setActionLoading(applicant.applicant_id);
                        const result = await acceptApplicant(taskId, applicant.applicant_id);
                        setActionLoading(null);
                        if (result.success) {
                            showToast(`${name} accepted as tasker!`, 'success');
                            onStatusChange?.();
                            setSelectedApplicant(null);
                            // Navigate to chat immediately if we have a room_id
                            if (result.room_id) {
                                onClose();
                                // Small delay to allow sheet close animation
                                setTimeout(() => {
                                    if (onAcceptSuccess) {
                                        onAcceptSuccess(result.room_id!);
                                    } else {
                                        router.push('/(tabs)/chat');
                                    }
                                }, 300);
                            } else {
                                fetchApplicants();
                            }
                        } else {
                            showToast(result.error ?? 'Failed to accept', 'error');
                        }
                    },
                },
            ],
        });
    };

    const handleReject = (applicant: TaskApplicant) => {
        const name = applicant.full_name ?? applicant.username ?? 'this user';
        setAlertConfig({
            visible: true,
            title: 'Reject Applicant',
            message: `Reject ${name}?\n\nThis user will be blocked from reapplying.`,
            variant: 'destructive',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        setActionLoading(applicant.applicant_id);
                        const result = await rejectApplicant(taskId, applicant.applicant_id);
                        setActionLoading(null);
                        if (result.success) {
                            showToast(`${name} rejected.`, 'warning');
                            fetchApplicants();
                            setSelectedApplicant(null);
                        } else {
                            showToast(result.error ?? 'Failed to reject', 'error');
                        }
                    },
                },
            ],
        });
    };

    const getRatingLabel = (_applicant: TaskApplicant) => {
        // Rating/reviews aren't currently modeled in this app DB. Keep UI polished with a safe placeholder.
        return 'New';
    };

    const renderApplicant = ({
        item,
        index,
    }: {
        item: TaskApplicant;
        index: number;
    }) => {
        const isAccepted = item.status === 'accepted';
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
                <Pressable
                    style={styles.cardPressable}
                    onPress={() => setSelectedApplicant(item)}
                    android_ripple={{ color: colors.border }}
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

                        {/* Rating row */}
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={13} color={colors.statusOrange} />
                            <Text style={[styles.ratingText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                {getRatingLabel(item)}
                            </Text>
                        </View>

                        {item.message ? (
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
                                {item.message}
                            </Text>
                        ) : (
                            <Text
                                style={[
                                    styles.message,
                                    { color: colors.textMuted, fontFamily: FontFamily.regular },
                                ]}
                                numberOfLines={1}
                            >
                                No message provided
                            </Text>
                        )}

                        {item.username && (
                            <Text
                                style={[
                                    styles.username,
                                    { color: colors.textMuted, fontFamily: FontFamily.regular },
                                ]}
                                numberOfLines={1}
                            >
                                @{item.username}
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

                    <View style={styles.chevronWrap}>
                        {isProcessing ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                        )}
                    </View>
                </Pressable>
            </Animated.View>
        );
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
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
                        <View style={styles.sheetHeader}>
                            <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Applicants
                            </Text>
                            <Text
                                style={[styles.sheetSubtitle, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                                numberOfLines={1}
                            >
                                {taskTitle}
                            </Text>
                            {taskStatus === 'assigned' && (
                                <View style={[styles.assignedBanner, { backgroundColor: colors.statusGreen + '15' }]}>
                                    <Ionicons name="checkmark-circle" size={16} color={colors.statusGreen} />
                                    <Text style={[styles.assignedBannerText, { color: colors.statusGreen, fontFamily: FontFamily.medium }]}>
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
                                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                                <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
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
                                ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
                            />
                        )}
                    </Animated.View>
                  </GestureDetector>
                </Animated.View>

                {/* Applicant details modal */}
                <Modal
                    visible={!!selectedApplicant}
                    transparent
                    animationType="fade"
                    statusBarTranslucent
                    onRequestClose={() => setSelectedApplicant(null)}
                >
                    <View style={[styles.detailOverlay, { backgroundColor: colors.overlay }]}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedApplicant(null)} />
                        <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <View style={styles.detailHeader}>
                                <Text style={[styles.detailTitle, { color: colors.text, fontFamily: FontFamily.bold }]} numberOfLines={1}>
                                    {selectedApplicant?.full_name ?? selectedApplicant?.username ?? 'Applicant'}
                                </Text>
                                <Pressable onPress={() => setSelectedApplicant(null)} hitSlop={10}>
                                    <Ionicons name="close" size={22} color={colors.textMuted} />
                                </Pressable>
                            </View>

                            <View style={styles.detailSection}>
                                <View style={styles.detailMetaRow}>
                                    <Ionicons name="star" size={14} color={colors.statusOrange} />
                                    <Text style={[styles.detailMetaText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                                        {selectedApplicant ? getRatingLabel(selectedApplicant) : '—'}
                                    </Text>
                                </View>
                                <Text style={[styles.detailLabel, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                    Application message
                                </Text>
                                <Text style={[styles.detailMessage, { color: colors.text, fontFamily: FontFamily.regular }]}>
                                    {selectedApplicant?.message?.trim()
                                        ? selectedApplicant.message.trim()
                                        : 'No message provided.'}
                                </Text>
                            </View>

                            <View style={styles.detailSection}>
                                <Text style={[styles.detailLabel, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                    Reviews
                                </Text>
                                <View style={[styles.reviewsPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} />
                                    <Text style={[styles.reviewsPlaceholderText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                        No reviews available yet
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.detailActions, { borderTopColor: colors.border }]}>
                                <Pressable
                                    style={[styles.detailBtn, { backgroundColor: colors.statusRed + '15', borderColor: colors.statusRed + '30' }]}
                                    onPress={() => selectedApplicant && handleReject(selectedApplicant)}
                                    disabled={!selectedApplicant || actionLoading === selectedApplicant.applicant_id || taskStatus !== 'open' || selectedApplicant.status !== 'pending'}
                                >
                                    <Text style={[styles.detailBtnText, { color: colors.statusRed, fontFamily: FontFamily.bold }]}>Deny</Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.detailBtn,
                                        {
                                            backgroundColor: colors.statusGreen,
                                            borderColor: colors.statusGreen,
                                            opacity: (!selectedApplicant || actionLoading === selectedApplicant.applicant_id || taskStatus !== 'open' || selectedApplicant.status !== 'pending') ? 0.5 : 1,
                                        },
                                    ]}
                                    onPress={() => selectedApplicant && handleAccept(selectedApplicant)}
                                    disabled={!selectedApplicant || actionLoading === selectedApplicant.applicant_id || taskStatus !== 'open' || selectedApplicant.status !== 'pending'}
                                >
                                    {actionLoading === selectedApplicant?.applicant_id ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={[styles.detailBtnText, { color: '#FFF', fontFamily: FontFamily.bold }]}>Accept</Text>
                                    )}
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Themed confirmation dialog */}
                <CustomAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    variant={alertConfig.variant}
                    buttons={alertConfig.buttons}
                    onDismiss={closeAlert}
                />
            </View>
        </Modal>
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
        padding: 0,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    cardPressable: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
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
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        marginBottom: 2,
    },
    ratingText: {
        fontSize: FontSize.xs,
    },
    username: {
        fontSize: FontSize.xs,
        marginTop: 4,
    },
    message: {
        fontSize: FontSize.sm,
        marginTop: Spacing.xs,
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
    chevronWrap: {
        marginLeft: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
    },

    // Detail modal styles
    detailOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    detailCard: {
        width: '100%',
        maxWidth: 520,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
    },
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    detailTitle: {
        fontSize: FontSize.xl,
        flex: 1,
        marginRight: Spacing.md,
    },
    detailSection: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    detailMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.sm,
    },
    detailMetaText: {
        fontSize: FontSize.sm,
    },
    detailLabel: {
        fontSize: FontSize.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: Spacing.sm,
    },
    detailMessage: {
        fontSize: FontSize.md,
        lineHeight: 22,
    },
    reviewsPlaceholder: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
    },
    reviewsPlaceholderText: {
        fontSize: FontSize.sm,
    },
    detailActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        padding: Spacing.xl,
        borderTopWidth: 1,
    },
    detailBtn: {
        flex: 1,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    detailBtnText: {
        fontSize: FontSize.md,
    },
});
