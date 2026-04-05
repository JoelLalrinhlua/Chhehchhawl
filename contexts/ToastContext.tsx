/**
 * ToastContext.tsx — Global in-app notification (toast) system.
 *
 * Provides a `showToast(message, type, duration?)` function anywhere in the tree.
 * Toasts slide up from the bottom, auto-dismiss, and match the Chhehchhawl theme.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
    showToast: () => {},
});

export function useToast() {
    return useContext(ToastContext);
}

// ── Single animated toast item ──────────────────────────────────

function ToastItem({
    toast,
    onDone,
    duration,
}: {
    toast: Toast;
    onDone: (id: number) => void;
    duration: number;
}) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(100);
    const opacity = useSharedValue(0);

    const dismiss = useCallback(() => {
        onDone(toast.id);
    }, [toast.id, onDone]);

    React.useEffect(() => {
        // slide up + fade in
        translateY.value = withTiming(0, { duration: 320 });
        opacity.value = withTiming(1, { duration: 280 });

        // after duration, fade out and remove
        opacity.value = withDelay(
            duration,
            withTiming(0, { duration: 280 }, (finished) => {
                if (finished) runOnJS(dismiss)();
            })
        );
        translateY.value = withDelay(duration, withTiming(80, { duration: 280 }));
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    const config = {
        success: { icon: 'checkmark-circle' as const, color: '#4CAF50', bg: '#4CAF5018' },
        error:   { icon: 'close-circle' as const,     color: '#F44336', bg: '#F4433618' },
        warning: { icon: 'warning' as const,           color: '#FF9800', bg: '#FF980018' },
        info:    { icon: 'information-circle' as const,color: colors.accent, bg: colors.accentLight },
    }[toast.type];

    return (
        <Animated.View
            style={[
                styles.toast,
                animStyle,
                {
                    backgroundColor: colors.surface,
                    borderColor: config.color + '40',
                    marginBottom: insets.bottom + Spacing.lg,
                },
            ]}
        >
            <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
                <Ionicons name={config.icon} size={20} color={config.color} />
            </View>
            <Text
                style={[styles.toastText, { color: colors.text, fontFamily: FontFamily.medium }]}
                numberOfLines={3}
            >
                {toast.message}
            </Text>
        </Animated.View>
    );
}

// ── Provider ────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<{ toast: Toast; duration: number }[]>([]);
    const counterRef = useRef(0);

    const showToast = useCallback(
        (message: string, type: ToastType = 'info', duration = 3000) => {
            const id = ++counterRef.current;
            setToasts((prev) => [...prev, { toast: { id, message, type }, duration }]);
        },
        []
    );

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View style={styles.container} pointerEvents="none">
                {toasts.map(({ toast, duration }) => (
                    <ToastItem
                        key={toast.id}
                        toast={toast}
                        duration={duration}
                        onDone={removeToast}
                    />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: Spacing.xl,
        right: Spacing.xl,
        zIndex: 99999,
        gap: Spacing.sm,
        alignItems: 'stretch',
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    toastText: {
        flex: 1,
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
});
