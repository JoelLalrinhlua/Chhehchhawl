/**
 * CustomAlert.tsx — Themed in-app modal dialog, replaces native Alert.alert.
 *
 * Features:
 * - Dark/light theme aware
 * - Icon per variant (success / error / warning / info / confirm / payment)
 * - Smooth fade + scale entry / exit (no bounce)
 * - Accent-colored primary action, ghost cancel button
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

export type AlertVariant = 'info' | 'success' | 'error' | 'warning' | 'confirm' | 'payment' | 'destructive';

export type AlertButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    variant?: AlertVariant;
    buttons?: AlertButton[];
    onDismiss?: () => void;
}

const VARIANT_CONFIG: Record<AlertVariant, { icon: string; iconColor: string; iconBg: string }> = {
    info:        { icon: 'information-circle',  iconColor: '#6C47FF', iconBg: '#6C47FF15' },
    success:     { icon: 'checkmark-circle',    iconColor: '#4CAF50', iconBg: '#4CAF5015' },
    error:       { icon: 'close-circle',        iconColor: '#F44336', iconBg: '#F4433615' },
    warning:     { icon: 'warning',             iconColor: '#FF9800', iconBg: '#FF980015' },
    confirm:     { icon: 'help-circle',         iconColor: '#FF9800', iconBg: '#FF980015' },
    payment:     { icon: 'wallet',              iconColor: '#6C47FF', iconBg: '#6C47FF15' },
    destructive: { icon: 'trash',               iconColor: '#F44336', iconBg: '#F4433615' },
};

const EASE_OUT = Easing.out(Easing.cubic);

// Inner component so the hook can run conditionally
function AlertContent({
    title,
    message,
    variant = 'info',
    buttons = [],
    onDismiss,
}: Omit<CustomAlertProps, 'visible'>) {
    const { colors } = useTheme();
    const cfg = VARIANT_CONFIG[variant];

    const scale = useSharedValue(0.88);
    const opacity = useSharedValue(0);

    React.useEffect(() => {
        scale.value = withTiming(1, { duration: 220, easing: EASE_OUT });
        opacity.value = withTiming(1, { duration: 180, easing: EASE_OUT });
    }, []);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
        >
            <Animated.View
                style={[
                    styles.card,
                    cardStyle,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
            >
                {/* Icon */}
                <View style={[styles.iconCircle, { backgroundColor: cfg.iconBg }]}>
                    <Ionicons name={cfg.icon as any} size={28} color={cfg.iconColor} />
                </View>

                {/* Text */}
                <Text style={[styles.title, { color: colors.text, fontFamily: FontFamily.bold }]}>
                    {title}
                </Text>
                <Text style={[styles.message, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                    {message}
                </Text>

                {/* Buttons */}
                {buttons.length === 0 ? (
                    // Single centred OK button
                    <Pressable
                        style={[styles.btn, styles.btnSingle, { backgroundColor: cfg.iconColor }]}
                        onPress={onDismiss}
                    >
                        <Text style={[styles.btnText, { fontFamily: FontFamily.bold }]}>OK</Text>
                    </Pressable>
                ) : buttons.length === 1 ? (
                    <Pressable
                        style={[
                            styles.btn,
                            styles.btnSingle,
                            {
                                backgroundColor:
                                    buttons[0].style === 'destructive'
                                        ? '#F44336'
                                        : buttons[0].style === 'cancel'
                                        ? 'transparent'
                                        : cfg.iconColor,
                                borderWidth: buttons[0].style === 'cancel' ? 1 : 0,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => {
                            buttons[0].onPress?.();
                            onDismiss?.();
                        }}
                    >
                        <Text
                            style={[
                                styles.btnText,
                                { fontFamily: FontFamily.bold },
                                buttons[0].style === 'cancel' && { color: colors.textMuted },
                            ]}
                        >
                            {buttons[0].text}
                        </Text>
                    </Pressable>
                ) : (
                    // 2-button row (exactly 2) or column stack (3+)
                    <View style={[styles.buttonRow, buttons.length > 2 && styles.buttonCol]}>
                        {buttons.map((btn, i) => {
                            const isDestructive = btn.style === 'destructive';
                            const isCancel = btn.style === 'cancel';
                            const isPrimary = !isDestructive && !isCancel;
                            // In column mode (3+ buttons) flex:1 collapses to 0 height
                            // because the parent has no fixed height — use width:'100%' instead.
                            const isColMode = buttons.length > 2;

                            return (
                                <Pressable
                                    key={i}
                                    style={[
                                        styles.btn,
                                        isColMode ? styles.btnFull : styles.btnFlex,
                                        isCancel && [styles.btnGhost, { borderColor: colors.border }],
                                        isDestructive && { backgroundColor: '#F44336' },
                                        isPrimary && { backgroundColor: cfg.iconColor },
                                    ]}
                                    onPress={() => {
                                        btn.onPress?.();
                                        onDismiss?.();
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.btnText,
                                            { fontFamily: FontFamily.bold },
                                            isCancel && { color: colors.textMuted },
                                        ]}
                                    >
                                        {btn.text}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </Animated.View>
        </Animated.View>
    );
}

export function CustomAlert({
    visible,
    title,
    message,
    variant = 'info',
    buttons = [],
    onDismiss,
}: CustomAlertProps) {
    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
            <AlertContent
                title={title}
                message={message}
                variant={variant}
                buttons={buttons}
                onDismiss={onDismiss}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        borderRadius: BorderRadius.xxl,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.lg,
        borderWidth: 1,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 12,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize.lg,
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    message: {
        fontSize: FontSize.sm,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: Spacing.xl,
    },
    // Single centred button (OK or one-button state)
    btnSingle: {
        width: '60%',
        alignSelf: 'center',
        marginBottom: Spacing.sm,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        width: '100%',
        marginBottom: Spacing.sm,
    },
    buttonCol: {
        flexDirection: 'column',
    },
    btn: {
        height: 46,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        minWidth: 80,
    },
    // Row mode (exactly 2 buttons): fill available width equally
    btnFlex: {
        flex: 1,
    },
    // Column mode (3+ buttons): fill full width, height driven by btn.height
    btnFull: {
        width: '100%' as const,
    },
    btnGhost: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    btnText: {
        fontSize: FontSize.md,
        color: '#FFF',
    },
});
