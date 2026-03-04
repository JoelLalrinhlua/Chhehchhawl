/**
 * SortSheet.tsx — Bottom-sheet modal for choosing the task-feed sort order.
 *
 * Sort fields: posted time, budget, distance, urgency.
 * Sort directions: ascending / descending.
 *
 * Exports `SortConfig`, `SortField`, `SortDirection`, and `DEFAULT_SORT`.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    SlideInDown,
    SlideOutDown,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export type SortField = 'posted' | 'budget' | 'distance' | 'urgency';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
    field: SortField;
    direction: SortDirection;
}

export const DEFAULT_SORT: SortConfig = {
    field: 'posted',
    direction: 'desc',
};

const SORT_OPTIONS: { field: SortField; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { field: 'posted', label: 'Posted Time', icon: 'time-outline' },
    { field: 'budget', label: 'Budget', icon: 'cash-outline' },
    { field: 'distance', label: 'Distance', icon: 'location-outline' },
    { field: 'urgency', label: 'Urgency', icon: 'flash-outline' },
];

interface SortSheetProps {
    visible: boolean;
    onClose: () => void;
    sortConfig: SortConfig;
    onApply: (config: SortConfig) => void;
}

export function SortSheet({ visible, onClose, sortConfig, onApply }: SortSheetProps) {
    const { colors } = useTheme();
    const translateY = useSharedValue(0);
    const [local, setLocal] = useState<SortConfig>(sortConfig);

    React.useEffect(() => {
        if (visible) {
            translateY.value = 0;
            setLocal(sortConfig);
        }
    }, [visible, sortConfig]);

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd((e) => {
            if (e.translationY > 120) {
                translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
                runOnJS(onClose)();
            } else {
                translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
            }
        });

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const handleSelect = (field: SortField) => {
        if (local.field === field) {
            setLocal((prev) => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
        } else {
            setLocal({ field, direction: field === 'posted' ? 'desc' : 'asc' });
        }
    };

    const handleApply = () => {
        onApply(local);
        onClose();
    };

    if (!visible) return null;

    return (
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <Animated.View
                entering={SlideInDown.springify().damping(20).stiffness(200)}
                exiting={SlideOutDown.duration(300)}
            >
                <GestureDetector gesture={panGesture}>
                    <Animated.View
                        style={[styles.sheet, { backgroundColor: colors.surface }, sheetStyle]}
                    >
                        <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />

                        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
                            <Text style={[styles.title, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Sort By
                            </Text>
                        </Animated.View>

                        <View style={styles.optionsList}>
                            {SORT_OPTIONS.map((opt) => {
                                const active = local.field === opt.field;
                                return (
                                    <Pressable
                                        key={opt.field}
                                        style={[
                                            styles.optionRow,
                                            {
                                                backgroundColor: active ? colors.accentLight : 'transparent',
                                                borderColor: active ? colors.accent + '30' : colors.border,
                                            },
                                        ]}
                                        onPress={() => handleSelect(opt.field)}
                                    >
                                        <View style={styles.optionLeft}>
                                            <Ionicons
                                                name={opt.icon}
                                                size={20}
                                                color={active ? colors.accent : colors.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.optionLabel,
                                                    {
                                                        color: active ? colors.accent : colors.text,
                                                        fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                                    },
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </View>
                                        {active && (
                                            <View style={styles.directionToggle}>
                                                <Ionicons
                                                    name={
                                                        local.direction === 'asc'
                                                            ? 'arrow-up'
                                                            : 'arrow-down'
                                                    }
                                                    size={18}
                                                    color={colors.accent}
                                                />
                                                <Text
                                                    style={[
                                                        styles.directionText,
                                                        { color: colors.accent, fontFamily: FontFamily.medium },
                                                    ]}
                                                >
                                                    {local.direction === 'asc' ? 'Low → High' : 'High → Low'}
                                                </Text>
                                            </View>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <Pressable
                                style={[styles.applyButton, { backgroundColor: colors.accent }]}
                                onPress={handleApply}
                            >
                                <Text style={[styles.applyText, { fontFamily: FontFamily.bold }]}>
                                    Apply Sort
                                </Text>
                            </Pressable>
                        </View>
                    </Animated.View>
                </GestureDetector>
            </Animated.View>
        </View>
    );
}

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
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        paddingTop: Spacing.md,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    header: {
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize.xxl,
    },
    optionsList: {
        paddingHorizontal: Spacing.xl,
        gap: Spacing.sm,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    optionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    optionLabel: {
        fontSize: FontSize.md,
    },
    directionToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    directionText: {
        fontSize: FontSize.sm,
    },
    footer: {
        padding: Spacing.xl,
        borderTopWidth: 1,
        marginTop: Spacing.md,
    },
    applyButton: {
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    applyText: {
        color: '#FFFFFF',
        fontSize: FontSize.lg,
    },
});
