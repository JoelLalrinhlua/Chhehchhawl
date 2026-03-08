/**
 * FilterSheet.tsx — Bottom-sheet modal for filtering the task feed.
 *
 * Allows the user to narrow results by:
 *  • Category (multi-select chip list)
 *  • Maximum distance (slider)
 *  • Urgency level (low / mid / urgent)
 *  • Task status (open / assigned / in-progress / completed / closed)
 *
 * Exports `FilterState`, `DEFAULT_FILTERS`, `getActiveFilterCount`, and `CATEGORIES`.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    FadeIn,
    FadeOut,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const CATEGORIES = [
    'General', 'Pick-Up', 'Delivery', 'Cleaning', 'Laundry',
    'Home', 'Office', 'Pet Care', 'Event Help', 'Tutoring',
    'Carrying', 'Repair', 'Others',
];

const DISTANCE_RANGES = [
    { key: 'any', label: 'Any' },
    { key: '<2', label: '<2km' },
    { key: '2-5', label: '2–5km' },
    { key: '5-10', label: '5–10km' },
    { key: '>10', label: '>10km' },
];

const URGENCY_OPTIONS = [
    { key: 'low', label: 'Low', color: '#4CAF50' },
    { key: 'mid', label: 'Mid', color: '#FF9800' },
    { key: 'urgent', label: 'Urgent', color: '#F44336' },
];

const STATUS_OPTIONS = [
    { key: 'open', label: 'Open' },
    { key: 'assigned', label: 'Assigned' },
];

export interface FilterState {
    categories: string[];
    distanceRange: string;
    urgencies: string[];
    statuses: string[];
}

export const DEFAULT_FILTERS: FilterState = {
    categories: [],
    distanceRange: 'any',
    urgencies: [],
    statuses: [],
};

export function getActiveFilterCount(filters: FilterState): number {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.distanceRange !== 'any') count++;
    if (filters.urgencies.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    return count;
}

interface FilterSheetProps {
    visible: boolean;
    onClose: () => void;
    filters: FilterState;
    onApply: (filters: FilterState) => void;
}

export function FilterSheet({ visible, onClose, filters, onApply }: FilterSheetProps) {
    const { colors } = useTheme();
    const translateY = useSharedValue(0);
    const [local, setLocal] = useState<FilterState>(filters);

    // Sync local state when opening
    React.useEffect(() => {
        if (visible) {
            translateY.value = 0;
            setLocal(filters);
        }
    }, [visible, filters]);

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

    const toggleCategory = (cat: string) => {
        setLocal((prev) => ({
            ...prev,
            categories: prev.categories.includes(cat)
                ? prev.categories.filter((c) => c !== cat)
                : [...prev.categories, cat],
        }));
    };

    const toggleUrgency = (u: string) => {
        setLocal((prev) => ({
            ...prev,
            urgencies: prev.urgencies.includes(u)
                ? prev.urgencies.filter((x) => x !== u)
                : [...prev.urgencies, u],
        }));
    };

    const toggleStatus = (s: string) => {
        setLocal((prev) => ({
            ...prev,
            statuses: prev.statuses.includes(s)
                ? prev.statuses.filter((x) => x !== s)
                : [...prev.statuses, s],
        }));
    };

    const handleReset = () => setLocal(DEFAULT_FILTERS);

    const handleApply = () => {
        onApply(local);
        onClose();
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
                        style={[styles.sheet, { backgroundColor: colors.surface }, sheetStyle]}
                    >
                        <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />

                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Filters
                            </Text>
                            <Pressable onPress={handleReset}>
                                <Text style={[styles.resetText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                    Reset
                                </Text>
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            style={styles.content}
                            contentContainerStyle={styles.contentInner}
                        >
                            {/* Category */}
                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                Category
                            </Text>
                            <View style={styles.chipGrid}>
                                {CATEGORIES.map((cat) => {
                                    const active = local.categories.includes(cat);
                                    return (
                                        <Pressable
                                            key={cat}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: active ? colors.accent : colors.card,
                                                    borderColor: active ? colors.accent : colors.border,
                                                },
                                            ]}
                                            onPress={() => toggleCategory(cat)}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    {
                                                        color: active ? '#FFF' : colors.text,
                                                        fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                                    },
                                                ]}
                                            >
                                                {cat}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {/* Distance */}
                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                Distance
                            </Text>
                            <View style={styles.chipRow}>
                                {DISTANCE_RANGES.map((d) => {
                                    const active = local.distanceRange === d.key;
                                    return (
                                        <Pressable
                                            key={d.key}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: active ? colors.accent : colors.card,
                                                    borderColor: active ? colors.accent : colors.border,
                                                },
                                            ]}
                                            onPress={() =>
                                                setLocal((prev) => ({ ...prev, distanceRange: d.key }))
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    {
                                                        color: active ? '#FFF' : colors.text,
                                                        fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                                    },
                                                ]}
                                            >
                                                {d.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {/* Urgency */}
                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                Urgency
                            </Text>
                            <View style={styles.chipRow}>
                                {URGENCY_OPTIONS.map((u) => {
                                    const active = local.urgencies.includes(u.key);
                                    return (
                                        <Pressable
                                            key={u.key}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: active ? u.color + '20' : colors.card,
                                                    borderColor: active ? u.color : colors.border,
                                                },
                                            ]}
                                            onPress={() => toggleUrgency(u.key)}
                                        >
                                            <Ionicons
                                                name="flash"
                                                size={13}
                                                color={active ? u.color : colors.textMuted}
                                            />
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    {
                                                        color: active ? u.color : colors.text,
                                                        fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                                    },
                                                ]}
                                            >
                                                {u.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            {/* Status */}
                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                Status
                            </Text>
                            <View style={styles.chipRow}>
                                {STATUS_OPTIONS.map((s) => {
                                    const active = local.statuses.includes(s.key);
                                    return (
                                        <Pressable
                                            key={s.key}
                                            style={[
                                                styles.chip,
                                                {
                                                    backgroundColor: active ? colors.accent : colors.card,
                                                    borderColor: active ? colors.accent : colors.border,
                                                },
                                            ]}
                                            onPress={() => toggleStatus(s.key)}
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,
                                                    {
                                                        color: active ? '#FFF' : colors.text,
                                                        fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                                    },
                                                ]}
                                            >
                                                {s.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>

                        {/* Footer */}
                        <View style={[styles.footer, { borderTopColor: colors.border }]}>
                            <Pressable
                                style={[styles.applyButton, { backgroundColor: colors.accent }]}
                                onPress={handleApply}
                            >
                                <Text style={[styles.applyText, { fontFamily: FontFamily.bold }]}>
                                    Apply Filters
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
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        width: '92%',
        maxHeight: SCREEN_HEIGHT * 0.7,
        borderRadius: BorderRadius.lg,
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize.xxl,
    },
    resetText: {
        fontSize: FontSize.md,
    },
    content: {
        maxHeight: SCREEN_HEIGHT * 0.48,
    },
    contentInner: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: FontSize.md,
        marginBottom: Spacing.md,
        marginTop: Spacing.lg,
    },
    chipGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    chipText: {
        fontSize: FontSize.sm,
    },
    footer: {
        padding: Spacing.xl,
        borderTopWidth: 1,
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
