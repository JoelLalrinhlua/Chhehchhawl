/**
 * TaskDetailSheet.tsx — Full-screen modal bottom sheet for viewing task details.
 *
 * Opened when the user taps a TaskCard. Displays:
 *  • Application status banner (pending / accepted / rejected / withdrawn)
 *  • Poster info, title, description, budget, urgency, media carousel
 *  • Location, categories, and creation date
 *  • Footer action button that adapts based on the viewer’s relationship to the task
 *    (own task, already applied, withdrawn, open, closed).
 *
 * Dismissal is handled via a pan-down gesture on the handle or a close button.
 */

import { MediaCarousel } from '@/components/MediaCarousel';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useApplications } from '@/contexts/ApplicationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDistance, formatTimeAgo } from '@/utils/distance';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TaskDetailSheetProps {
    task: Task;
    visible: boolean;
    onClose: () => void;
    distanceKm?: number | null;
    /** Called when the owner deletes the task. Sheet closes automatically. */
    onDelete?: (taskId: string) => Promise<void>;
}

export function TaskDetailSheet({ task, visible, onClose, distanceKm, onDelete }: TaskDetailSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { applyForTask, withdrawApplication, getMyApplicationStatus } =
        useApplications();
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [applyLoading, setApplyLoading] = useState(false);
    const [showMessageInput, setShowMessageInput] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const isOwnTask = user?.id === task.created_by;

    // Fetch application status on mount
    const fetchStatus = useCallback(async () => {
        if (!user || isOwnTask) {
            setStatusLoading(false);
            return;
        }
        setStatusLoading(true);
        const result = await getMyApplicationStatus(task.id);
        setApplicationStatus(result.status);
        setStatusLoading(false);
    }, [task.id, user, isOwnTask, getMyApplicationStatus]);

    useEffect(() => {
        if (visible) {
            // Fast slide-up entry — no bounce
            translateY.value = SCREEN_HEIGHT;
            translateY.value = withTiming(0, { duration: 250 });
            backdropOpacity.value = withTiming(1, { duration: 200 });
            fetchStatus();
            setShowMessageInput(false);
            setApplyMessage('');
        } else {
            translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
            backdropOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible, fetchStatus]);

    const panGesture = Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetY(-10)
        .onUpdate((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
                // Fade backdrop as user drags down
                const progress = Math.min(event.translationY / 300, 1);
                backdropOpacity.value = 1 - progress;
            }
        })
        .onEnd((event) => {
            if (event.translationY > 120 || event.velocityY > 500) {
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
                backdropOpacity.value = withTiming(0, { duration: 200 });
                runOnJS(onClose)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
                backdropOpacity.value = withTiming(1, { duration: 200 });
            }
        });

    const sheetAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const handleApply = async () => {
        if (!showMessageInput) {
            setShowMessageInput(true);
            return;
        }
        setApplyLoading(true);
        const result = await applyForTask(task.id, applyMessage || undefined);
        setApplyLoading(false);

        if (result.success) {
            setApplicationStatus('pending');
            setShowMessageInput(false);
            Alert.alert('Applied!', 'Your application has been submitted.');
        } else {
            Alert.alert('Error', result.error ?? 'Failed to apply');
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Task',
            'Are you sure you want to delete this task? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!onDelete) return;
                        setDeleteLoading(true);
                        try {
                            await onDelete(task.id);
                            onClose();
                        } catch {
                            Alert.alert('Error', 'Failed to delete task. Please try again.');
                        } finally {
                            setDeleteLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleWithdraw = () => {
        Alert.alert(
            'Withdraw Application',
            'Are you sure you want to withdraw your application?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Withdraw',
                    style: 'destructive',
                    onPress: async () => {
                        setApplyLoading(true);
                        const result = await withdrawApplication(task.id);
                        setApplyLoading(false);
                        if (result.success) {
                            setApplicationStatus('withdrawn');
                        } else {
                            Alert.alert(
                                'Error',
                                result.error ?? 'Failed to withdraw'
                            );
                        }
                    },
                },
            ]
        );
    };

    const getStatusLabel = (status: Task['status']) => {
        switch (status) {
            case 'open':
                return 'Open';
            case 'assigned':
                return 'Assigned';
            case 'in-progress':
                return 'In Progress';
            case 'completed':
                return 'Completed';
            case 'cancelled':
                return 'Cancelled';
        }
    };

    const getStatusColor = (status: Task['status']) => {
        switch (status) {
            case 'open':
                return colors.statusGreen;
            case 'assigned':
                return colors.statusOrange;
            case 'in-progress':
                return colors.statusOrange;
            case 'completed':
                return colors.textMuted;
            case 'cancelled':
                return colors.statusRed;
        }
    };

    // Determine footer button state
    const renderFooterButton = () => {
        if (isOwnTask) {
            return (
                <View style={styles.ownPostFooter}>
                    <View
                        style={[
                            styles.ownPostLabel,
                            { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                        ]}
                    >
                        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                        <Text
                            style={[
                                styles.applyText,
                                { color: colors.textMuted, fontFamily: FontFamily.medium, marginLeft: 6, fontSize: FontSize.md },
                            ]}
                        >
                            Your Post
                        </Text>
                    </View>
                    {onDelete && (
                        <Pressable
                            style={[
                                styles.deleteButton,
                                { backgroundColor: colors.statusRed + '15', borderWidth: 1, borderColor: colors.statusRed + '30' },
                            ]}
                            onPress={handleDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? (
                                <ActivityIndicator size="small" color={colors.statusRed} />
                            ) : (
                                <>
                                    <Ionicons name="trash-outline" size={18} color={colors.statusRed} />
                                    <Text
                                        style={[
                                            styles.deleteText,
                                            { color: colors.statusRed, fontFamily: FontFamily.bold },
                                        ]}
                                    >
                                        Delete Task
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>
            );
        }

        if (statusLoading) {
            return (
                <View style={[styles.applyButton, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                </View>
            );
        }

        if (applicationStatus === 'accepted') {
            return (
                <View
                    style={[
                        styles.applyButton,
                        { backgroundColor: colors.statusGreen + '20' },
                    ]}
                >
                    <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.statusGreen}
                    />
                    <Text
                        style={[
                            styles.applyText,
                            { color: colors.statusGreen, fontFamily: FontFamily.bold, marginLeft: 8 },
                        ]}
                    >
                        You've Been Accepted!
                    </Text>
                </View>
            );
        }

        if (applicationStatus === 'pending') {
            return (
                <Pressable
                    style={[
                        styles.applyButton,
                        { backgroundColor: colors.statusOrange + '20' },
                    ]}
                    onPress={handleWithdraw}
                    disabled={applyLoading}
                >
                    {applyLoading ? (
                        <ActivityIndicator size="small" color={colors.statusOrange} />
                    ) : (
                        <>
                            <Ionicons
                                name="time"
                                size={18}
                                color={colors.statusOrange}
                            />
                            <Text
                                style={[
                                    styles.applyText,
                                    {
                                        color: colors.statusOrange,
                                        fontFamily: FontFamily.bold,
                                        marginLeft: 8,
                                    },
                                ]}
                            >
                                Applied • Tap to Withdraw
                            </Text>
                        </>
                    )}
                </Pressable>
            );
        }

        if (applicationStatus === 'rejected') {
            return (
                <View
                    style={[
                        styles.applyButton,
                        { backgroundColor: colors.statusRed + '15' },
                    ]}
                >
                    <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.statusRed}
                    />
                    <Text
                        style={[
                            styles.applyText,
                            { color: colors.statusRed, fontFamily: FontFamily.medium, marginLeft: 8 },
                        ]}
                    >
                        Not Available
                    </Text>
                </View>
            );
        }

        if (task.status !== 'open') {
            return (
                <View
                    style={[
                        styles.applyButton,
                        { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                    ]}
                >
                    <Text
                        style={[
                            styles.applyText,
                            { color: colors.textMuted, fontFamily: FontFamily.medium },
                        ]}
                    >
                        No Longer Accepting Applications
                    </Text>
                </View>
            );
        }

        // Can apply
        return (
            <Pressable
                style={[styles.applyButton, { backgroundColor: colors.accent }]}
                onPress={handleApply}
                disabled={applyLoading}
            >
                {applyLoading ? (
                    <ActivityIndicator size="small" color="#FFF" />
                ) : (
                    <Text style={[styles.applyText, { fontFamily: FontFamily.bold }]}>
                        {showMessageInput ? 'Submit Application' : 'Apply for Task'}
                    </Text>
                )}
            </Pressable>
        );
    };

    const SHEET_HEIGHT = SCREEN_HEIGHT * 0.82;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={styles.overlay}>
                <Animated.View style={[styles.backdrop, { backgroundColor: colors.overlay }, backdropAnimatedStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                </Animated.View>
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                backgroundColor: colors.surface,
                                height: SHEET_HEIGHT,
                                paddingBottom: insets.bottom,
                            },
                            sheetAnimatedStyle,
                        ]}
                    >
                        <View style={styles.handleArea}>
                            <View style={[styles.handle, { backgroundColor: colors.textMuted + '80' }]} />
                        </View>

                    <ScrollView
                        showsVerticalScrollIndicator={true}
                        style={styles.content}
                        contentContainerStyle={styles.contentContainer}
                        bounces={true}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Status + Poster username */}
                        <View style={styles.statusRow}>
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: getStatusColor(task.status) + '20' },
                                ]}
                            >
                                <View
                                    style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]}
                                />
                                <Text
                                    style={[
                                        styles.statusText,
                                        { color: getStatusColor(task.status), fontFamily: FontFamily.medium },
                                    ]}
                                >
                                    {getStatusLabel(task.status)}
                                </Text>
                            </View>
                            {task.poster_name && (
                                <View style={styles.posterRow}>
                                    <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                                    <Text
                                        style={[
                                            styles.posterName,
                                            { color: colors.textMuted, fontFamily: FontFamily.medium },
                                        ]}
                                    >
                                        @{task.poster_name}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* 1. Title */}
                        <Text style={[styles.title, { color: colors.text, fontFamily: FontFamily.bold }]}>
                            {task.title}
                        </Text>

                        {/* 2. Description — full, no truncation */}
                        <Text
                            style={[styles.description, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                        >
                            {task.description || 'No description provided.'}
                        </Text>

                        {task.extra_description && (
                            <Text
                                style={[
                                    styles.extraDesc,
                                    { color: colors.textSecondary, fontFamily: FontFamily.regular },
                                ]}
                            >
                                {task.extra_description}
                            </Text>
                        )}

                        {/* 3. Budget */}
                        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.infoRow}>
                                <View style={styles.infoLabelRow}>
                                    <Ionicons name="cash-outline" size={16} color={colors.accent} />
                                    <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                        Budget
                                    </Text>
                                </View>
                                <Text style={[styles.infoValue, { color: colors.accent, fontFamily: FontFamily.bold }]}>
                                    ₹{task.budget}
                                </Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            <View style={styles.infoRow}>
                                <View style={styles.infoLabelRow}>
                                    <Ionicons name="swap-horizontal-outline" size={16} color={colors.textMuted} />
                                    <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                        Negotiable
                                    </Text>
                                </View>
                                <Text style={[styles.infoValue, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                    {task.negotiable ? 'Yes' : 'No'}
                                </Text>
                            </View>
                        </View>

                        {/* 4. Urgency */}
                        {task.urgency && (
                            <View style={[styles.urgencyCard, {
                                backgroundColor: (task.urgency === 'urgent'
                                    ? colors.statusRed
                                    : task.urgency === 'mid'
                                      ? colors.statusOrange
                                      : colors.statusGreen) + '12',
                                borderColor: (task.urgency === 'urgent'
                                    ? colors.statusRed
                                    : task.urgency === 'mid'
                                      ? colors.statusOrange
                                      : colors.statusGreen) + '30',
                            }]}>
                                <Ionicons
                                    name={task.urgency === 'urgent' ? 'flash' : task.urgency === 'mid' ? 'alert-circle-outline' : 'time-outline'}
                                    size={18}
                                    color={
                                        task.urgency === 'urgent'
                                            ? colors.statusRed
                                            : task.urgency === 'mid'
                                              ? colors.statusOrange
                                              : colors.statusGreen
                                    }
                                />
                                <Text
                                    style={[
                                        styles.urgencyText,
                                        {
                                            color:
                                                task.urgency === 'urgent'
                                                    ? colors.statusRed
                                                    : task.urgency === 'mid'
                                                      ? colors.statusOrange
                                                      : colors.statusGreen,
                                            fontFamily: FontFamily.semiBold,
                                        },
                                    ]}
                                >
                                    {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)} Priority
                                </Text>
                            </View>
                        )}

                        {/* 5. Media (Images/Videos carousel) */}
                        {task.media_urls && task.media_urls.length > 0 && (
                            <View style={styles.mediaSection}>
                                <MediaCarousel mediaUrls={task.media_urls} />
                            </View>
                        )}

                        {/* 6. Location */}
                        {(task.location || task.locality || distanceKm != null) && (
                            <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={styles.locationHeader}>
                                    <Ionicons name="location" size={18} color={colors.accent} />
                                    <Text style={[styles.locationTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                        Location
                                    </Text>
                                </View>
                                {task.location && (
                                    <Text style={[styles.locationText, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                                        {task.location}
                                    </Text>
                                )}
                                {task.locality && (
                                    <Text style={[styles.localityText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                        {task.locality}
                                    </Text>
                                )}
                                {distanceKm != null && (
                                    <View style={styles.distanceRow}>
                                        <Ionicons name="navigate-outline" size={14} color={colors.accent} />
                                        <Text style={[styles.distanceText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                            {formatDistance(distanceKm)} away
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 7. Additional Information */}
                        <View style={[styles.additionalInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.additionalInfoHeader}>
                                <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
                                <Text style={[styles.additionalInfoTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                    Additional Details
                                </Text>
                            </View>

                            <View style={styles.infoRow}>
                                <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                    Posted
                                </Text>
                                <Text style={[styles.infoValue, { color: colors.text, fontFamily: FontFamily.medium }]}>
                                    {formatTimeAgo(task.created_at)}
                                </Text>
                            </View>

                            {distanceKm != null && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.infoRow}>
                                        <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                            Distance
                                        </Text>
                                        <Text style={[styles.infoValue, { color: colors.text, fontFamily: FontFamily.medium }]}>
                                            {formatDistance(distanceKm)}
                                        </Text>
                                    </View>
                                </>
                            )}

                            {task.categories.length > 0 && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.categoriesSection}>
                                        <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: FontFamily.regular, marginBottom: Spacing.sm }]}>
                                            Categories
                                        </Text>
                                        <View style={styles.categoriesRow}>
                                            {task.categories.map((cat) => (
                                                <View
                                                    key={cat}
                                                    style={[styles.categoryChip, { backgroundColor: colors.accentLight }]}
                                                >
                                                    <Text style={[styles.categoryText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                                        {cat}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        {/* Optional message input when applying */}
                        {showMessageInput && !isOwnTask && task.status === 'open' && (
                            <View>
                                <Text
                                    style={[
                                        styles.msgLabel,
                                        { color: colors.textSecondary, fontFamily: FontFamily.medium },
                                    ]}
                                >
                                    Add a message (optional)
                                </Text>
                                <TextInput
                                    style={[
                                        styles.msgInput,
                                        {
                                            backgroundColor: colors.inputBackground,
                                            color: colors.text,
                                            borderColor: colors.border,
                                            fontFamily: FontFamily.regular,
                                        },
                                    ]}
                                    placeholder="Why are you a good fit for this task?"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={200}
                                    value={applyMessage}
                                    onChangeText={setApplyMessage}
                                />
                            </View>
                        )}
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                        {renderFooterButton()}
                    </View>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        overflow: 'hidden',
    },
    handleArea: {
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xs,
        alignItems: 'center',
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 3,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.xl,
    },
    contentContainer: {
        paddingBottom: Spacing.xl + Spacing.sm,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.full,
        gap: Spacing.xs,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: FontSize.sm,
    },
    posterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    posterName: {
        fontSize: FontSize.sm,
    },
    title: {
        fontSize: FontSize.xl,
        marginBottom: Spacing.sm,
        lineHeight: 28,
    },
    description: {
        fontSize: FontSize.md,
        lineHeight: 24,
        marginBottom: Spacing.md,
    },
    extraDesc: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: Spacing.lg,
        fontStyle: 'italic',
    },
    infoCard: {
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    infoLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    infoLabel: {
        fontSize: FontSize.md,
    },
    infoValue: {
        fontSize: FontSize.lg,
    },
    divider: {
        height: 1,
        marginVertical: Spacing.xs,
    },
    urgencyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    urgencyText: {
        fontSize: FontSize.md,
    },
    mediaSection: {
        marginBottom: Spacing.lg,
    },
    locationCard: {
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    locationTitle: {
        fontSize: FontSize.md,
    },
    locationText: {
        fontSize: FontSize.md,
        lineHeight: 22,
        marginBottom: 4,
    },
    localityText: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: 4,
    },
    distanceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.xs,
    },
    distanceText: {
        fontSize: FontSize.sm,
    },
    additionalInfo: {
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    additionalInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    additionalInfoTitle: {
        fontSize: FontSize.md,
    },
    categoriesSection: {
        paddingVertical: Spacing.sm,
    },
    categoriesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    categoryChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.full,
    },
    categoryText: {
        fontSize: FontSize.sm,
    },
    msgLabel: {
        fontSize: FontSize.sm,
        marginBottom: Spacing.sm,
    },
    msgInput: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        fontSize: FontSize.md,
        minHeight: 80,
        textAlignVertical: 'top',
        marginBottom: Spacing.lg,
    },
    footer: {
        padding: Spacing.xl,
        borderTopWidth: 1,
    },
    applyButton: {
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    applyText: {
        color: '#FFFFFF',
        fontSize: FontSize.lg,
    },
    ownPostFooter: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    ownPostLabel: {
        flex: 1,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    deleteButton: {
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    deleteText: {
        fontSize: FontSize.md,
    },
});


