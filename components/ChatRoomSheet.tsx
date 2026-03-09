/**
 * ChatRoomSheet.tsx — Full-screen modal for an individual chat conversation.
 *
 * Shows message history with real-time updates via Supabase Realtime.
 * Uses an inverted FlatList for chat-style scrolling.
 * Includes task title in header, input field, and send button.
 * Features: completion flow (mark complete / confirm), chat lock after
 * completion, task detail access via header button.
 */

import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useChatMessagesQuery, type ChatMessage } from '@/hooks/use-chat-queries';
import {
    useConfirmTaskCompletionMutation,
    useFinishTaskMutation,
    useMarkMessagesSeenMutation,
    useSendMessageMutation,
} from '@/hooks/use-mutations';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatRoomSheetProps {
    roomId: string;
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    otherUserName: string | null;
    taskerCompleted: boolean;
    posterConfirmed: boolean;
    posterId: string;
    taskerId: string;
    visible: boolean;
    onClose: () => void;
}

export function ChatRoomSheet({
    roomId,
    taskId,
    taskTitle,
    taskStatus,
    otherUserName,
    taskerCompleted,
    posterConfirmed,
    posterId,
    taskerId,
    visible,
    onClose,
}: ChatRoomSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { tasks } = useTasks();
    const insets = useSafeAreaInsets();
    const [messageText, setMessageText] = useState('');
    const [completionLoading, setCompletionLoading] = useState(false);
    const [taskDetailVisible, setTaskDetailVisible] = useState(false);
    const flatListRef = useRef<FlatList<ChatMessage>>(null);

    const { data: messages = [] } = useChatMessagesQuery(roomId, visible);
    const sendMutation = useSendMessageMutation(user?.id);
    const markSeenMutation = useMarkMessagesSeenMutation();
    const finishMutation = useFinishTaskMutation(user?.id);
    const confirmMutation = useConfirmTaskCompletionMutation(user?.id);

    const isTasker = user?.id === taskerId;
    const isPoster = user?.id === posterId;
    const isChatLocked = taskStatus === 'completed';

    // Find the full task object for TaskDetailSheet
    const fullTask = useMemo(
        () => tasks.find((t) => t.id === taskId),
        [tasks, taskId]
    );

    // Mark messages as seen when entering the room
    useEffect(() => {
        if (visible && user?.id && roomId) {
            markSeenMutation.mutate({ roomId, userId: user.id });
        }
    }, [visible, roomId, user?.id]);

    // Realtime subscription for new messages
    useEffect(() => {
        if (!visible || !roomId) return;

        const channel = supabase
            .channel(`messages:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`,
                },
                () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.chat.messages(roomId),
                    });
                    // Mark as seen when receiving
                    if (user?.id) {
                        markSeenMutation.mutate({ roomId, userId: user.id });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [visible, roomId, user?.id]);

    // Realtime subscription for task status changes (completion flow)
    useEffect(() => {
        if (!visible || !taskId || !user?.id) return;

        const channel = supabase
            .channel(`chat-task:${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks',
                    filter: `id=eq.${taskId}`,
                },
                () => {
                    // Refresh chat rooms so parent passes fresh props
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.chat.rooms(user!.id),
                    });
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.tasks.all,
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [visible, taskId, user?.id]);

    const handleSend = useCallback(async () => {
        const trimmed = messageText.trim();
        if (!trimmed || !user?.id || isChatLocked) return;

        setMessageText('');
        try {
            await sendMutation.mutateAsync({ roomId, message: trimmed });
        } catch {
            setMessageText(trimmed); // Restore on failure
        }
    }, [messageText, roomId, user?.id, sendMutation, isChatLocked]);

    const handleFinishTask = useCallback(() => {
        Alert.alert(
            'Mark as Complete',
            'Are you sure you want to mark this task as complete?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Complete',
                    onPress: async () => {
                        setCompletionLoading(true);
                        try {
                            await finishMutation.mutateAsync({ taskId });
                            // Immediately refresh chat rooms so props update
                            if (user?.id) {
                                await queryClient.invalidateQueries({
                                    queryKey: queryKeys.chat.rooms(user.id),
                                });
                            }
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to mark complete');
                        } finally {
                            setCompletionLoading(false);
                        }
                    },
                },
            ]
        );
    }, [taskId, finishMutation, user?.id]);

    const handleConfirmCompletion = useCallback(() => {
        Alert.alert(
            'Confirm Completion',
            'Confirm that this task has been completed successfully?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setCompletionLoading(true);
                        try {
                            await confirmMutation.mutateAsync({ taskId });
                            // Immediately refresh chat rooms so props update
                            if (user?.id) {
                                await queryClient.invalidateQueries({
                                    queryKey: queryKeys.chat.rooms(user.id),
                                });
                            }
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to confirm');
                        } finally {
                            setCompletionLoading(false);
                        }
                    },
                },
            ]
        );
    }, [taskId, confirmMutation, user?.id]);

    // Invert the messages for FlatList inverted mode
    const invertedMessages = [...messages].reverse();

    const renderMessage = useCallback(
        ({ item }: { item: ChatMessage }) => {
            const isOwn = item.sender_id === user?.id;
            return (
                <View
                    style={[
                        styles.messageBubbleRow,
                        isOwn ? styles.ownRow : styles.otherRow,
                    ]}
                >
                    <View
                        style={[
                            styles.messageBubble,
                            isOwn
                                ? [styles.ownBubble, { backgroundColor: colors.accent }]
                                : [styles.otherBubble, { backgroundColor: colors.card }],
                        ]}
                    >
                        <Text
                            style={[
                                styles.messageText,
                                {
                                    color: isOwn ? '#FFFFFF' : colors.text,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                        >
                            {item.message}
                        </Text>
                        <Text
                            style={[
                                styles.messageTime,
                                {
                                    color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                        >
                            {formatTime(item.created_at)}
                        </Text>
                    </View>
                </View>
            );
        },
        [user?.id, colors]
    );

    // ── Status bar config ──
    const getStatusBarConfig = useCallback(() => {
        if (isChatLocked) {
            return { label: 'Completed', color: colors.textMuted, icon: 'checkmark-circle' as const };
        }
        if (taskStatus === 'pending_confirmation') {
            return { label: 'Pending Confirmation', color: colors.statusOrange, icon: 'hourglass' as const };
        }
        if (taskStatus === 'in-progress') {
            return { label: 'In Progress', color: colors.statusOrange, icon: 'time' as const };
        }
        if (taskStatus === 'assigned') {
            return { label: 'Assigned', color: colors.statusGreen, icon: 'person' as const };
        }
        return null;
    }, [taskStatus, isChatLocked, colors]);

    const statusBarConfig = getStatusBarConfig();

    // ── Completion action button ──
    const renderCompletionAction = () => {
        if (isChatLocked) return null;

        // Tasker can mark complete if they haven't yet
        if (isTasker && !taskerCompleted) {
            return (
                <Pressable
                    style={[styles.completionButton, { backgroundColor: colors.statusGreen }]}
                    onPress={handleFinishTask}
                    disabled={completionLoading}
                >
                    {completionLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="checkmark-done" size={16} color="#FFF" />
                            <Text style={[styles.completionButtonText, { fontFamily: FontFamily.bold }]}>
                                Mark as Complete
                            </Text>
                        </>
                    )}
                </Pressable>
            );
        }

        // Tasker already marked complete — show waiting state
        if (isTasker && taskerCompleted && !posterConfirmed) {
            return (
                <View style={[styles.waitingBadge, { backgroundColor: colors.statusOrange + '15' }]}>
                    <Ionicons name="hourglass-outline" size={14} color={colors.statusOrange} />
                    <Text style={[styles.waitingText, { color: colors.statusOrange, fontFamily: FontFamily.medium }]}>
                        Waiting for confirmation
                    </Text>
                </View>
            );
        }

        // Poster can confirm if tasker has finished but poster hasn't confirmed
        if (isPoster && taskerCompleted && !posterConfirmed) {
            return (
                <Pressable
                    style={[styles.completionButton, { backgroundColor: colors.statusGreen }]}
                    onPress={handleConfirmCompletion}
                    disabled={completionLoading}
                >
                    {completionLoading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                            <Text style={[styles.completionButtonText, { fontFamily: FontFamily.bold }]}>
                                Confirm Completion
                            </Text>
                        </>
                    )}
                </Pressable>
            );
        }

        return null;
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={[styles.container, { backgroundColor: colors.background }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Header */}
                <View
                    style={[
                        styles.header,
                        {
                            backgroundColor: colors.surface,
                            borderBottomColor: colors.border,
                            paddingTop: insets.top + Spacing.sm,
                        },
                    ]}
                >
                    <Pressable onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerContent}>
                        <Text
                            style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}
                            numberOfLines={1}
                        >
                            {otherUserName ?? 'Chat'}
                        </Text>
                        <Text
                            style={[styles.headerSubtitle, { color: colors.textMuted, fontFamily: FontFamily.regular }]}
                            numberOfLines={1}
                        >
                            {taskTitle}
                        </Text>
                    </View>
                    {fullTask && (
                        <Pressable
                            onPress={() => setTaskDetailVisible(true)}
                            style={styles.headerInfoButton}
                        >
                            <Ionicons name="document-text-outline" size={22} color={colors.accent} />
                        </Pressable>
                    )}
                </View>

                {/* Status bar + completion action */}
                {(statusBarConfig || renderCompletionAction()) && (
                    <View
                        style={[
                            styles.statusBar,
                            { backgroundColor: colors.surface, borderBottomColor: colors.border },
                        ]}
                    >
                        {statusBarConfig && (
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: statusBarConfig.color + '15' },
                                ]}
                            >
                                <Ionicons
                                    name={statusBarConfig.icon}
                                    size={14}
                                    color={statusBarConfig.color}
                                />
                                <Text
                                    style={[
                                        styles.statusBadgeText,
                                        {
                                            color: statusBarConfig.color,
                                            fontFamily: FontFamily.medium,
                                        },
                                    ]}
                                >
                                    {statusBarConfig.label}
                                </Text>
                            </View>
                        )}
                        {renderCompletionAction()}
                    </View>
                )}

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={invertedMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    inverted
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                />

                {/* Input or locked banner */}
                {isChatLocked ? (
                    <View
                        style={[
                            styles.lockedBanner,
                            {
                                backgroundColor: colors.surface,
                                borderTopColor: colors.border,
                                paddingBottom: insets.bottom + Spacing.sm,
                            },
                        ]}
                    >
                        <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                        <Text
                            style={[
                                styles.lockedText,
                                { color: colors.textMuted, fontFamily: FontFamily.regular },
                            ]}
                        >
                            This task has been completed
                        </Text>
                    </View>
                ) : (
                    <View
                        style={[
                            styles.inputRow,
                            {
                                backgroundColor: colors.surface,
                                borderTopColor: colors.border,
                                paddingBottom: insets.bottom + Spacing.sm,
                            },
                        ]}
                    >
                        <TextInput
                            style={[
                                styles.textInput,
                                {
                                    backgroundColor: colors.inputBackground,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    fontFamily: FontFamily.regular,
                                },
                            ]}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textMuted}
                            value={messageText}
                            onChangeText={setMessageText}
                            multiline
                            maxLength={2000}
                        />
                        <Pressable
                            style={[
                                styles.sendButton,
                                {
                                    backgroundColor: messageText.trim()
                                        ? colors.accent
                                        : colors.card,
                                },
                            ]}
                            onPress={handleSend}
                            disabled={!messageText.trim() || sendMutation.isPending}
                        >
                            <Ionicons
                                name="send"
                                size={20}
                                color={messageText.trim() ? '#FFFFFF' : colors.textMuted}
                            />
                        </Pressable>
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Task Detail Sheet */}
            {fullTask && taskDetailVisible && (
                <TaskDetailSheet
                    task={fullTask}
                    visible={taskDetailVisible}
                    onClose={() => setTaskDetailVisible(false)}
                />
            )}
        </Modal>
    );
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        marginLeft: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.lg,
    },
    headerSubtitle: {
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    headerInfoButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        gap: Spacing.sm,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
        gap: 4,
    },
    statusBadgeText: {
        fontSize: FontSize.xs,
    },
    completionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        gap: 6,
    },
    completionButtonText: {
        fontSize: FontSize.sm,
        color: '#FFFFFF',
    },
    waitingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: 4,
        borderRadius: BorderRadius.md,
        gap: 4,
    },
    waitingText: {
        fontSize: FontSize.xs,
    },
    lockedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        gap: Spacing.sm,
    },
    lockedText: {
        fontSize: FontSize.sm,
    },
    messageList: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    messageBubbleRow: {
        marginBottom: Spacing.sm,
        flexDirection: 'row',
    },
    ownRow: {
        justifyContent: 'flex-end',
    },
    otherRow: {
        justifyContent: 'flex-start',
    },
    messageBubble: {
        maxWidth: '78%',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        borderRadius: BorderRadius.lg,
    },
    ownBubble: {
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        borderBottomLeftRadius: 4,
    },
    messageText: {
        fontSize: FontSize.md,
        lineHeight: 22,
    },
    messageTime: {
        fontSize: FontSize.xs - 1,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        gap: Spacing.sm,
    },
    textInput: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
        fontSize: FontSize.md,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
