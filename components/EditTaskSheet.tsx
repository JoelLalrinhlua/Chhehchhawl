import { AnimatedInput } from '@/components/AnimatedInput';
import { CustomAlert } from '@/components/CustomAlert';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { type Task, useTasks } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

interface EditTaskSheetProps {
    task: Task;
    visible: boolean;
    onClose: () => void;
}

const URGENCY_LEVELS = [
    { key: 'low' as const, label: 'Low', color: '#4CAF50' },
    { key: 'mid' as const, label: 'Mid', color: '#FF9800' },
    { key: 'urgent' as const, label: 'Urgent', color: '#F44336' },
];

export function EditTaskSheet({ task, visible, onClose }: EditTaskSheetProps) {
    const { colors } = useTheme();
    const { updateTask, refreshTasks } = useTasks();

    const [title, setTitle] = useState(task.title);
    const [description, setDescription] = useState(task.description || '');
    const [urgency, setUrgency] = useState(task.urgency);
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

    useEffect(() => {
        if (visible) {
            setTitle(task.title);
            setDescription(task.description || '');
            setUrgency(task.urgency);
            setLoading(false);
        }
    }, [visible, task]);

    const handleSave = async () => {
        if (!title.trim() || !description.trim()) {
            setAlertConfig({ visible: true, title: 'Incomplete', message: 'Title and description cannot be empty.' });
            return;
        }

        setLoading(true);
        const { error } = await updateTask(task.id, {
            title: title.trim(),
            description: description.trim(),
            urgency,
        });

        setLoading(false);

        if (error) {
            setAlertConfig({ visible: true, title: 'Error', message: error });
        } else {
            refreshTasks();
            onClose();
        }
    };

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.overlay, { backgroundColor: colors.overlay }]}>
                    <Animated.View entering={ZoomIn.duration(220)} exiting={ZoomOut.duration(160)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        
                        <View style={styles.header}>
                            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Task</Text>
                            <Pressable onPress={onClose} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </Pressable>
                        </View>

                        <ScrollView style={styles.content}>
                            <AnimatedInput
                                label="Task Title"
                                value={title}
                                onChangeText={setTitle}
                                maxLength={60}
                            />
                            
                            <AnimatedInput
                                label="Description"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                numberOfLines={4}
                                maxLength={600}
                                style={{ minHeight: 100, textAlignVertical: 'top' }}
                            />

                            <Text style={[styles.label, { color: colors.text }]}>Urgency Level</Text>
                            <View style={styles.urgencyRow}>
                                {URGENCY_LEVELS.map((level) => {
                                    const isActive = urgency === level.key;
                                    return (
                                        <Pressable
                                            key={level.key}
                                            style={[
                                                styles.urgencyOption,
                                                {
                                                    backgroundColor: isActive ? level.color : colors.inputBackground,
                                                    borderColor: isActive ? level.color : colors.border,
                                                },
                                            ]}
                                            onPress={() => setUrgency(isActive ? null : level.key)}
                                        >
                                            <Text
                                                style={[
                                                    styles.urgencyText,
                                                    {
                                                        color: isActive ? '#FFF' : colors.text,
                                                        fontFamily: isActive ? FontFamily.bold : FontFamily.medium,
                                                    },
                                                ]}
                                            >
                                                {level.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        <View style={styles.footer}>
                            <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave} disabled={loading}>
                                {loading ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={styles.saveText}>Save Changes</Text>
                                )}
                            </Pressable>
                        </View>
                    </Animated.View>
                </Animated.View>

                <CustomAlert
                    visible={alertConfig.visible}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    onDismiss={() => setAlertConfig({ ...alertConfig, visible: false })}
                />
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.xl,
        zIndex: 999,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerTitle: {
        fontFamily: FontFamily.bold,
        fontSize: FontSize.lg,
    },
    closeBtn: {
        padding: Spacing.xs,
    },
    content: {
        padding: Spacing.lg,
    },
    label: {
        fontFamily: FontFamily.semiBold,
        fontSize: FontSize.md,
        marginBottom: Spacing.md,
        marginTop: Spacing.lg,
    },
    urgencyRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    urgencyOption: {
        flex: 1,
        height: 44,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    urgencyText: {
        fontSize: FontSize.sm,
    },
    footer: {
        padding: Spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    saveBtn: {
        height: 48,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveText: {
        color: '#FFF',
        fontFamily: FontFamily.bold,
        fontSize: FontSize.md,
    },
});
