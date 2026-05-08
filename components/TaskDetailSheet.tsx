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

import { CustomAlert, type AlertButton } from '@/components/CustomAlert';
import { EditTaskSheet } from '@/components/EditTaskSheet';
import { MediaCarousel } from '@/components/MediaCarousel';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useApplications } from '@/contexts/ApplicationContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDistance, formatTimeAgo } from '@/utils/distance';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    KeyboardAvoidingView,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    ZoomOut,
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
    /** Called when tasker marks task finished */
    onFinishTask?: (taskId: string) => Promise<void>;
    /** Called when poster confirms completion */
    onConfirmCompletion?: (taskId: string) => Promise<void>;
}

export function TaskDetailSheet({ task, visible, onClose, distanceKm, onDelete, onFinishTask, onConfirmCompletion }: TaskDetailSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { showToast } = useToast();
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
    const [completionLoading, setCompletionLoading] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    // Custom alert state
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean; title: string; message: string;
        variant: 'confirm' | 'destructive' | 'info';
        buttons: AlertButton[];
    }>({ visible: false, title: '', message: '', variant: 'confirm', buttons: [] });
    const closeAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));

    const isOwnTask = user?.id === task.created_by;
    const isAssignedTasker = user?.id === task.assigned_to;

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

            // Prefetch all task images into memory+disk cache immediately
            // so they appear instantly when the carousel renders.
            if (task.media_urls && task.media_urls.length > 0) {
                task.media_urls.forEach((url) => {
                    if (!url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm|m4v)($|\?)/)) {
                        Image.prefetch(url, 'memory-disk').catch(() => {});
                    }
                });
            }
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
        const trimmed = applyMessage.trim();
        if (trimmed.length < 1) {
            showToast('Please add a message before submitting.', 'warning');
            return;
        }
        setApplyLoading(true);
        const result = await applyForTask(task.id, trimmed);
        setApplyLoading(false);

        if (result.success) {
            setApplicationStatus('pending');
            setShowMessageInput(false);
            showToast('Application submitted!', 'success');
        } else {
            showToast(result.error ?? 'Failed to apply', 'error');
        }
    };

    const handleDelete = () => {
        setAlertConfig({
            visible: true,
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            variant: 'destructive',
            buttons: [
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
                            showToast('Failed to delete task. Please try again.', 'error');
                        } finally {
                            setDeleteLoading(false);
                        }
                    },
                },
            ],
        });
    };

    const handleWithdraw = () => {
        setAlertConfig({
            visible: true,
            title: 'Withdraw Application',
            message: 'Are you sure you want to withdraw your application?',
            variant: 'destructive',
            buttons: [
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
                            showToast('Application withdrawn.', 'info');
                        } else {
                            showToast(result.error ?? 'Failed to withdraw', 'error');
                        }
                    },
                },
            ],
        });
    };

    const getStatusLabel = (status: Task['status']) => {
        switch (status) {
            case 'open': return 'Open';
            case 'assigned': return 'Assigned';
            case 'in-progress': return 'In Progress';
            case 'pending_confirmation': return 'Pending Confirmation';
            case 'payment_pending': return 'Payment Pending';
            case 'payment_sent': return 'Payment Sent';
            case 'completed': return 'Completed';
            case 'cancelled': return 'Cancelled';
        }
    };

    const getStatusColor = (status: Task['status']) => {
        switch (status) {
            case 'open': return colors.statusGreen;
            case 'assigned': return colors.statusOrange;
            case 'in-progress': return colors.statusOrange;
            case 'pending_confirmation': return colors.statusOrange;
            case 'payment_pending': return colors.statusOrange;
            case 'payment_sent': return colors.statusGreen;
            case 'completed': return colors.textMuted;
            case 'cancelled': return colors.statusRed;
        }
    };

    // Determine footer button state
    const renderFooterButton = () => {
        // ── Assigned tasker: Finish Task / Waiting for payment ──
        if (isAssignedTasker && ['assigned', 'in-progress'].includes(task.status)) {
            return (
                <Pressable
                    style={[styles.applyButton, { backgroundColor: colors.statusGreen }]}
                    onPress={() => {
                        setAlertConfig({
                            visible: true,
                            title: 'Finish Task',
                            message: 'Mark this task as finished? The poster will be asked to pay via UPI.',
                            variant: 'confirm',
                            buttons: [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Finish',
                                    style: 'default',
                                    onPress: async () => {
                                        if (!onFinishTask) return;
                                        setCompletionLoading(true);
                                        try {
                                            await onFinishTask(task.id);
                                        } catch (err: any) {
                                            showToast(err.message || 'Failed to finish task', 'error');
                                        } finally {
                                            setCompletionLoading(false);
                                        }
                                    },
                                },
                            ],
                        });
                    }}
                    disabled={completionLoading}
                >
                    {completionLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={[styles.applyText, { fontFamily: FontFamily.bold }]}>
                            Finish Task
                        </Text>
                    )}
                </Pressable>
            );
        }

        // ── Assigned tasker: payment in progress states ──
        if (isAssignedTasker && ['payment_pending', 'payment_sent'].includes(task.status)) {
            return (
                <View style={[styles.applyButton, { backgroundColor: colors.statusOrange + '20' }]}>
                    <Ionicons name="wallet-outline" size={18} color={colors.statusOrange} />
                    <Text style={[styles.applyText, { color: colors.statusOrange, fontFamily: FontFamily.bold, marginLeft: 8 }]}>
                        {task.status === 'payment_pending' ? 'Waiting for Payment' : 'Open Chat to Confirm Receipt'}
                    </Text>
                </View>
            );
        }

        // ── Own task: poster payment actions ──
        if (isOwnTask) {
            // Poster needs to pay — direct them to open chat
            if (task.status === 'payment_pending') {
                return (
                    <View style={[styles.applyButton, { backgroundColor: '#6C47FF' + '20' }]}>
                        <Ionicons name="wallet-outline" size={18} color="#6C47FF" />
                        <Text style={[styles.applyText, { color: '#6C47FF', fontFamily: FontFamily.bold, marginLeft: 8 }]}>
                            Open Chat to Pay
                        </Text>
                    </View>
                );
            }
            if (task.status === 'payment_sent') {
                return (
                    <View style={[styles.applyButton, { backgroundColor: colors.statusGreen + '20' }]}>
                        <Ionicons name="checkmark-circle-outline" size={18} color={colors.statusGreen} />
                        <Text style={[styles.applyText, { color: colors.statusGreen, fontFamily: FontFamily.bold, marginLeft: 8 }]}>
                            Payment Sent — Awaiting Confirmation
                        </Text>
                    </View>
                );
            }

            return (
                <View style={styles.ownPostFooter}>
                    {task.status === 'open' ? (
                        <Pressable
                            style={[
                                styles.ownPostLabel,
                                { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
                            ]}
                            onPress={() => setEditingTask(task)}
                        >
                            <Ionicons name="create-outline" size={16} color={colors.text} />
                            <Text
                                style={[
                                    styles.applyText,
                                    { color: colors.text, fontFamily: FontFamily.semiBold, marginLeft: 6, fontSize: FontSize.md },
                                ]}
                            >
                                Edit Task
                            </Text>
                        </Pressable>
                    ) : (
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
                    )}
                    {onDelete && task.status === 'open' && (
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
                onPress={() => setShowMessageInput(true)}
                disabled={applyLoading}
            >
                <Text style={[styles.applyText, { fontFamily: FontFamily.bold }]}>
                    Apply for Task
                </Text>
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
                    <View style={styles.headerContainer}>
                        <GestureDetector gesture={panGesture}>
                            <View style={styles.handleArea}>
                                <View style={[styles.handle, { backgroundColor: colors.textMuted + '80' }]} />
                            </View>
                        </GestureDetector>
                        <Pressable 
                            style={styles.closeButtonAbsolute} 
                            onPress={onClose}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close-circle" size={26} color={colors.textMuted + '90'} />
                        </Pressable>
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


                        {/* 3. Media (Images/Videos carousel) */}
                        {task.media_urls && task.media_urls.length > 0 && (
                            <View style={styles.mediaSection}>
                                <MediaCarousel mediaUrls={task.media_urls} />
                            </View>
                        )}

                        {/* ── Divider between content and details ── */}
                        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

                        {/* 4. Urgency pill + distance pill */}
                        {(task.urgency || distanceKm != null) && (
                            <View style={styles.metaStrip}>
                                {task.urgency && (
                                    <View style={[styles.metaPill, {
                                        backgroundColor: (task.urgency === 'urgent'
                                            ? colors.statusRed
                                            : task.urgency === 'mid'
                                              ? colors.statusOrange
                                              : colors.statusGreen) + '18',
                                        borderColor: (task.urgency === 'urgent'
                                            ? colors.statusRed
                                            : task.urgency === 'mid'
                                              ? colors.statusOrange
                                              : colors.statusGreen) + '40',
                                    }]}>
                                        <Ionicons
                                            name={task.urgency === 'urgent' ? 'flash' : task.urgency === 'mid' ? 'alert-circle-outline' : 'time-outline'}
                                            size={13}
                                            color={
                                                task.urgency === 'urgent'
                                                    ? colors.statusRed
                                                    : task.urgency === 'mid'
                                                      ? colors.statusOrange
                                                      : colors.statusGreen
                                            }
                                        />
                                        <Text style={[styles.metaPillText, {
                                            color: task.urgency === 'urgent'
                                                ? colors.statusRed
                                                : task.urgency === 'mid'
                                                  ? colors.statusOrange
                                                  : colors.statusGreen,
                                            fontFamily: FontFamily.semiBold,
                                        }]}>
                                            {task.urgency.charAt(0).toUpperCase() + task.urgency.slice(1)} Priority
                                        </Text>
                                    </View>
                                )}
                                {distanceKm != null && (
                                    <View style={[styles.metaPill, { backgroundColor: colors.accentLight, borderColor: colors.accent + '30' }]}>
                                        <Ionicons name="navigate-outline" size={13} color={colors.accent} />
                                        <Text style={[styles.metaPillText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                            {formatDistance(distanceKm)} away
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* 5. Additional Details */}
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

                            {(task.latitude != null && task.longitude != null) || task.locality ? (
                                <>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <Pressable
                                        style={[styles.mapButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                                        onPress={() => {
                                            const url = task.latitude != null && task.longitude != null
                                                ? `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`
                                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.locality ?? '')}`;
                                            Linking.openURL(url).catch(() => {});
                                        }}
                                    >
                                        <View style={[styles.mapButtonIcon, { backgroundColor: '#16a34a18' }]}>
                                            <Ionicons name="map" size={22} color="#16a34a" />
                                        </View>
                                        <View style={styles.mapButtonText}>
                                            <Text style={[styles.mapButtonTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                                View on Map
                                            </Text>
                                            {task.locality && (
                                                <Text style={[styles.mapButtonSub, { color: colors.textMuted, fontFamily: FontFamily.regular }]} numberOfLines={1}>
                                                    {task.locality}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={[styles.mapOpenBadge, { backgroundColor: '#16a34a18' }]}>
                                            <Ionicons name="open-outline" size={14} color="#16a34a" />
                                            <Text style={[styles.mapOpenBadgeText, { color: '#16a34a', fontFamily: FontFamily.semiBold }]}>Maps</Text>
                                        </View>
                                    </Pressable>
                                </>
                            ) : null}

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

                        {/* 6. Budget — prominent green card at the end */}
                        <View style={[styles.budgetCard, { backgroundColor: '#16a34a14', borderColor: '#16a34a40' }]}>
                            <View style={styles.budgetLeft}>
                                <View style={[styles.budgetIconCircle, { backgroundColor: '#16a34a20' }]}>
                                    <Ionicons name="cash" size={20} color="#16a34a" />
                                </View>
                                <View>
                                    <Text style={[styles.budgetLabel, { color: '#16a34a', fontFamily: FontFamily.medium }]}>
                                        Budget
                                    </Text>
                                    <Text style={[styles.budgetAmount, { color: '#16a34a', fontFamily: FontFamily.bold }]}>
                                        ₹{task.budget}
                                    </Text>
                                </View>
                            </View>
                            {task.negotiable && (
                                <View style={[styles.negotiablePill, { backgroundColor: '#16a34a20' }]}>
                                    <Ionicons name="swap-horizontal" size={13} color="#16a34a" />
                                    <Text style={[styles.negotiableText, { color: '#16a34a', fontFamily: FontFamily.semiBold }]}>
                                        Negotiable
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                        {renderFooterButton()}
                    </View>
                </Animated.View>

                {/* Application Popup Modal */}
                {showMessageInput && (
                    <Animated.View 
                        entering={FadeIn.duration(200)}
                        exiting={FadeOut.duration(200)}
                        style={[StyleSheet.absoluteFill, styles.popupOverlayCenter, { backgroundColor: colors.overlay }]}
                    >
                        <KeyboardAvoidingView 
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ width: '100%', alignItems: 'center' }}
                        >
                            <Animated.View 
                                entering={ZoomIn.duration(220)}
                                exiting={ZoomOut.duration(160)}
                                style={[styles.popupCard, { backgroundColor: colors.surface }]}
                            >
                                <Text style={[styles.popupTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                    Apply for Task
                                </Text>
                                <Text style={[styles.popupSub, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                                    Add a short message to the poster (required)
                                </Text>
                                
                                <TextInput
                                    style={[
                                        styles.popupInput,
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
                                    autoFocus
                                />

                                <View style={styles.popupActions}>
                                    <Pressable 
                                        style={[styles.popupBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} 
                                        onPress={() => setShowMessageInput(false)}
                                    >
                                        <Text style={[styles.popupBtnText, { color: colors.text, fontFamily: FontFamily.medium }]}>Cancel</Text>
                                    </Pressable>
                                    <Pressable 
                                        style={[
                                            styles.popupBtn,
                                            styles.popupBtnPrimary,
                                            { backgroundColor: applyMessage.trim().length >= 1 ? colors.accent : colors.textMuted },
                                        ]} 
                                        onPress={handleApply}
                                        disabled={applyLoading || applyMessage.trim().length < 1}
                                    >
                                        {applyLoading ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <Text style={[styles.popupBtnText, { color: '#FFF', fontFamily: FontFamily.bold }]}>Submit</Text>
                                        )}
                                    </Pressable>
                                </View>
                            </Animated.View>
                        </KeyboardAvoidingView>
                    </Animated.View>
                )}
            </GestureHandlerRootView>

            {/* Edit Task Sheet (overlays on top of this sheet) */}
            {editingTask && (
                <EditTaskSheet
                    task={editingTask}
                    visible={!!editingTask}
                    onClose={() => setEditingTask(null)}
                />
            )}

            {/* Themed confirmation dialog */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                variant={alertConfig.variant}
                buttons={alertConfig.buttons}
                onDismiss={closeAlert}
            />
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
        flex: 1, // So it occupies center area between close button
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 3,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    closeButtonAbsolute: {
        position: 'absolute',
        right: Spacing.xl,
        top: Spacing.md,
        zIndex: 10,
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
    sectionDivider: {
        height: 1,
        marginVertical: Spacing.lg,
        opacity: 0.6,
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
    // ── Budget card ──
    budgetCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.md,
    },
    budgetLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    budgetIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    budgetLabel: {
        fontSize: FontSize.sm,
        marginBottom: 2,
    },
    budgetAmount: {
        fontSize: FontSize.xxl,
    },
    negotiablePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    negotiableText: {
        fontSize: FontSize.xs,
    },
    // ── Quick-meta pill strip ──
    metaStrip: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 1,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    metaPillText: {
        fontSize: FontSize.sm,
        maxWidth: 160,
    },
    sectionLabel: {
        fontSize: FontSize.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: Spacing.xs,
    },
    // ── Map button (Location row) ──
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.md,
    },
    mapButtonIcon: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapButtonText: {
        flex: 1,
    },
    mapButtonTitle: {
        fontSize: FontSize.md,
        marginBottom: 2,
    },
    mapButtonSub: {
        fontSize: FontSize.xs,
    },
    mapOpenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
    },
    mapOpenBadgeText: {
        fontSize: FontSize.xs,
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
    popupOverlayCenter: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
        zIndex: 999,
    },
    popupCard: {
        width: '100%',
        maxWidth: 400,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    popupTitle: {
        fontSize: FontSize.xl,
        marginBottom: Spacing.xs,
    },
    popupSub: {
        fontSize: FontSize.sm,
        marginBottom: Spacing.lg,
    },
    popupInput: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        fontSize: FontSize.md,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: Spacing.xl,
    },
    popupActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    popupBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    popupBtnPrimary: {
        borderWidth: 0,
    },
    popupBtnText: {
        fontSize: FontSize.md,
    },
});


