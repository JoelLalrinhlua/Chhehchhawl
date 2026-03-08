/**
 * TaskCard.tsx — Displays a single task in the feed.
 *
 * Supports two layouts:
 *  • **grid** — compact card for a 2-column FlatList.
 *  • **list** — full-width card with extra details (category chip, description preview).
 *
 * Shows urgency badge, title, budget, distance from the user, and relative time.
 * Wrapped in `React.memo` to avoid unnecessary re-renders when parent re-renders.
 */

import { BorderRadius, FontFamily, FontSize, Shadows, Spacing } from '@/constants/theme';
import type { Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDistance, formatTimeAgoShort } from '@/utils/distance';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface TaskCardProps {
    task: Task;
    onPress: (task: Task) => void;
    mode?: 'grid' | 'list';
    distanceKm?: number | null;
}

const URGENCY_CONFIG = {
    low: { color: '#4CAF50', label: 'Low', icon: 'time-outline' as const },
    mid: { color: '#FF9800', label: 'Mid', icon: 'alert-circle-outline' as const },
    urgent: { color: '#F44336', label: 'Urgent', icon: 'flash' as const },
};

export const TaskCard = React.memo(function TaskCard({ task, onPress, mode = 'grid', distanceKm }: TaskCardProps) {
    const { colors } = useTheme();

    const timeAgo = formatTimeAgoShort(task.created_at);
    const distanceText = distanceKm != null ? formatDistance(distanceKm) : null;
    const urgencyCfg = task.urgency ? URGENCY_CONFIG[task.urgency] : null;

    if (mode === 'list') {
        return (
            <Pressable
                style={[
                    listStyles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    Shadows.subtle,
                ]}
                onPress={() => onPress(task)}
            >
                {/* Top row: urgency badge (left) + title */}
                <View style={listStyles.topRow}>
                    {urgencyCfg && (
                        <View style={[listStyles.urgencyBadge, { backgroundColor: urgencyCfg.color + '18' }]}>
                            <Ionicons name={urgencyCfg.icon} size={12} color={urgencyCfg.color} />
                            <Text
                                style={[
                                    listStyles.urgencyText,
                                    { color: urgencyCfg.color, fontFamily: FontFamily.semiBold },
                                ]}
                            >
                                {urgencyCfg.label}
                            </Text>
                        </View>
                    )}
                    <Text
                        style={[listStyles.title, { color: colors.text, fontFamily: FontFamily.bold }]}
                        numberOfLines={1}
                    >
                        {task.title}
                    </Text>
                </View>

                {/* Description */}
                <Text
                    style={[listStyles.description, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                    numberOfLines={2}
                >
                    {task.description || 'No description'}
                </Text>

                {/* Category chip */}
                {task.categories.length > 0 && (
                    <View style={listStyles.categoryRow}>
                        <View
                            style={[listStyles.categoryChip, { backgroundColor: colors.accentLight }]}
                        >
                            <Text style={[listStyles.categoryText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                {task.categories[0]}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Bottom row: distance (left) + time (right) */}
                <View style={listStyles.bottomRow}>
                    <View style={listStyles.bottomLeft}>
                        <View style={listStyles.metaItem}>
                            <Ionicons
                                name="location-outline"
                                size={13}
                                color={distanceText ? colors.accent : colors.textMuted}
                            />
                            <Text
                                style={[
                                    listStyles.metaText,
                                    {
                                        color: distanceText ? colors.textSecondary : colors.textMuted,
                                        fontFamily: distanceText ? FontFamily.medium : FontFamily.regular,
                                    },
                                ]}
                            >
                                {distanceText ?? '—'}
                            </Text>
                        </View>
                    </View>
                    <View style={listStyles.bottomRight}>
                        <View style={listStyles.metaItem}>
                            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                            <Text style={[listStyles.metaText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                {timeAgo}
                            </Text>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    }

    // ── Grid (tile) mode ──
    return (
        <Pressable
            style={[
                gridStyles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                Shadows.card,
            ]}
            onPress={() => onPress(task)}
        >
            {/* Top row: urgency badge (left) + title */}
            <View style={gridStyles.topRow}>
                {urgencyCfg && (
                    <View style={[gridStyles.urgencyBadge, { backgroundColor: urgencyCfg.color + '18' }]}>
                        <Ionicons name={urgencyCfg.icon} size={10} color={urgencyCfg.color} />
                    </View>
                )}
                <Text
                    style={[gridStyles.title, { color: colors.text, fontFamily: FontFamily.bold }]}
                    numberOfLines={2}
                >
                    {task.title}
                </Text>
            </View>

            {/* Description */}
            <Text
                style={[gridStyles.description, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                numberOfLines={3}
            >
                {task.description || 'No description'}
            </Text>

            {/* Bottom row: distance (left) + time (right) */}
            <View style={gridStyles.bottomRow}>
                <View style={gridStyles.metaItem}>
                    <Ionicons
                        name="location-outline"
                        size={11}
                        color={distanceText ? colors.accent : colors.textMuted}
                    />
                    <Text
                        style={[
                            gridStyles.metaText,
                            {
                                color: distanceText ? colors.textSecondary : colors.textMuted,
                                fontFamily: distanceText ? FontFamily.medium : FontFamily.regular,
                            },
                        ]}
                    >
                        {distanceText ?? '—'}
                    </Text>
                </View>
                <View style={gridStyles.metaItem}>
                    <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                    <Text style={[gridStyles.metaText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        {timeAgo}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
});

// ── Grid Styles ──
const gridStyles = StyleSheet.create({
    card: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        margin: Spacing.sm,
        borderWidth: 1,
        minHeight: 145,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xs,
        gap: Spacing.sm,
    },
    urgencyBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: FontSize.sm,
        flex: 1,
        lineHeight: 19,
    },
    description: {
        fontSize: FontSize.xs,
        lineHeight: 16,
        flex: 1,
        marginBottom: Spacing.xs,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        fontSize: FontSize.xs,
    },
});

// ── List Styles ──
const listStyles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginHorizontal: Spacing.sm,
        marginVertical: Spacing.xs + 2,
        borderWidth: 1,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    title: {
        fontSize: FontSize.md,
        flex: 1,
        lineHeight: 21,
    },
    urgencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
        gap: Spacing.xs,
    },
    urgencyText: {
        fontSize: FontSize.xs,
    },
    description: {
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginBottom: Spacing.sm,
    },
    categoryRow: {
        flexDirection: 'row',
        marginBottom: Spacing.sm,
    },
    categoryChip: {
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    categoryText: {
        fontSize: FontSize.xs,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    bottomLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    bottomRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaText: {
        fontSize: FontSize.xs,
    },
});
