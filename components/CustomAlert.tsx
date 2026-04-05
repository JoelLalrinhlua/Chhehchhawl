import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';

export type AlertButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
    onDismiss?: () => void;
}

export function CustomAlert({ visible, title, message, buttons = [], onDismiss }: CustomAlertProps) {
    const { colors } = useTheme();

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
            <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={[styles.overlay, { backgroundColor: colors.overlay }]}
            >
                <Animated.View
                    entering={ZoomIn.duration(200).springify()}
                    exiting={ZoomOut.duration(200)}
                    style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
                    <View style={styles.buttonRow}>
                        {buttons.length === 0 ? (
                            <Pressable
                                style={[styles.button, { backgroundColor: colors.accent }]}
                                onPress={onDismiss}
                            >
                                <Text style={[styles.buttonText, { color: '#FFF' }]}>OK</Text>
                            </Pressable>
                        ) : (
                            buttons.map((btn, index) => {
                                const isDestructive = btn.style === 'destructive';
                                const isCancel = btn.style === 'cancel';
                                return (
                                    <Pressable
                                        key={index}
                                        style={[
                                            styles.button,
                                            isDestructive && { backgroundColor: '#FF4444' },
                                            isCancel && { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
                                            !isDestructive && !isCancel && { backgroundColor: colors.accent },
                                            buttons.length > 1 && { flex: 1 },
                                        ]}
                                        onPress={() => {
                                            if (btn.onPress) btn.onPress();
                                            if (onDismiss) onDismiss();
                                        }}
                                    >
                                        <Text style={[
                                            styles.buttonText,
                                            isCancel ? { color: colors.text } : { color: '#FFF' },
                                        ]}>
                                            {btn.text}
                                        </Text>
                                    </Pressable>
                                );
                            })
                        )}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: Spacing.xl,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    title: {
        fontFamily: FontFamily.bold,
        fontSize: FontSize.lg,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    message: {
        fontFamily: FontFamily.regular,
        fontSize: FontSize.md,
        marginBottom: Spacing.xl,
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    button: {
        height: 48,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    buttonText: {
        fontFamily: FontFamily.semiBold,
        fontSize: FontSize.md,
    },
});
