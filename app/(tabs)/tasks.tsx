/**
 * (tabs)/tasks.tsx — Task feed screen.
 *
 * Renders all available tasks in a FlatList (grid or list mode).
 * Features:
 *  • Filter by category, distance, urgency, and status (FilterSheet)
 *  • Sort by time, budget, distance, or urgency (SortSheet)
 *  • Toggle between grid / list layout
 *  • Distance calculation from the user’s current location via `expo-location`
 *  • Pull-to-refresh and perf-tuned FlatList props
 */

import { DEFAULT_FILTERS, FilterSheet, getActiveFilterCount, type FilterState } from '@/components/FilterSheet';
import { DEFAULT_SORT, SortSheet, type SortConfig } from '@/components/SortSheet';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTasks, type Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { haversine } from '@/utils/distance';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const URGENCY_ORDER = { urgent: 3, mid: 2, low: 1 };

export default function HomeScreen() {
    const { colors } = useTheme();
    const { tasks } = useTasks();
    const router = useRouter();

    // ── State ──
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortVisible, setSortVisible] = useState(false);
    const [locationText, setLocationText] = useState('Fetching location...');

    // User coordinates for distance calculations
    const userCoords = useRef<{ latitude: number; longitude: number } | null>(null);

    // ── Location ──
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationText('Location unavailable');
                return;
            }
            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                userCoords.current = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                };
                const [geo] = await Location.reverseGeocodeAsync(userCoords.current);
                if (geo) {
                    const parts = [geo.name, geo.district, geo.city].filter(Boolean);
                    setLocationText(parts.join(', ') || 'Current Location');
                }
            } catch {
                setLocationText('Location unavailable');
            }
        })();
    }, []);

    // ── FAB ──
    const fabScale = useSharedValue(1);
    const fabAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: fabScale.value }],
    }));

    const handleCreateTask = () => {
        fabScale.value = withSpring(0.9, { damping: 15 }, () => {
            fabScale.value = withSpring(1, { damping: 15 });
        });
        router.push('/create-task');
    };

    // ── Distance calculator ──
    const getDistanceKm = useCallback(
        (task: Task): number | null => {
            if (!userCoords.current || task.latitude == null || task.longitude == null) return null;
            return haversine(
                userCoords.current.latitude,
                userCoords.current.longitude,
                task.latitude,
                task.longitude
            );
        },
        []
    );

    // ── Processed tasks: filter → sort → enrich ──
    const processedTasks = useMemo(() => {
        let result = [...tasks];

        // Filter: categories
        if (filters.categories.length > 0) {
            result = result.filter((t) =>
                t.categories.some((c) => filters.categories.includes(c))
            );
        }

        // Filter: urgencies
        if (filters.urgencies.length > 0) {
            result = result.filter(
                (t) => t.urgency && filters.urgencies.includes(t.urgency)
            );
        }

        // Filter: statuses
        if (filters.statuses.length > 0) {
            result = result.filter((t) => filters.statuses.includes(t.status));
        }

        // Filter: distance range
        if (filters.distanceRange !== 'any' && userCoords.current) {
            result = result.filter((t) => {
                const d = getDistanceKm(t);
                if (d == null) return false;
                switch (filters.distanceRange) {
                    case '<2': return d < 2;
                    case '2-5': return d >= 2 && d <= 5;
                    case '5-10': return d >= 5 && d <= 10;
                    case '>10': return d > 10;
                    default: return true;
                }
            });
        }

        // Sort
        result.sort((a, b) => {
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            switch (sortConfig.field) {
                case 'budget':
                    return (a.budget - b.budget) * dir;
                case 'posted':
                    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
                case 'distance': {
                    const da = getDistanceKm(a) ?? 99999;
                    const db = getDistanceKm(b) ?? 99999;
                    return (da - db) * dir;
                }
                case 'urgency': {
                    const ua = a.urgency ? URGENCY_ORDER[a.urgency] : 0;
                    const ub = b.urgency ? URGENCY_ORDER[b.urgency] : 0;
                    return (ua - ub) * dir;
                }
                default:
                    return 0;
            }
        });

        return result;
    }, [tasks, filters, sortConfig, getDistanceKm]);

    // ── View toggle ──
    const toggleViewMode = () => {
        setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
    };

    const activeFilterCount = getActiveFilterCount(filters);

    // ── Render cards ──
    const renderGridCard = useCallback(
        ({ item }: { item: Task }) => (
            <View style={{ flex: 1, maxWidth: '50%' }}>
                <TaskCard task={item} onPress={setSelectedTask} mode="grid" distanceKm={getDistanceKm(item)} />
            </View>
        ),
        [getDistanceKm]
    );

    const renderListCard = useCallback(
        ({ item }: { item: Task }) => (
            <TaskCard task={item} onPress={setSelectedTask} mode="list" distanceKm={getDistanceKm(item)} />
        ),
        [getDistanceKm]
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <Animated.View entering={FadeIn.duration(600)} style={[styles.header, { backgroundColor: colors.accent }]}>
                <Text style={[styles.headerTitle, { fontFamily: FontFamily.bold }]}>Find Task</Text>
                <AnimatedPressable
                    style={[styles.fab, { backgroundColor: colors.background }, fabAnimatedStyle]}
                    onPress={handleCreateTask}
                >
                    <Ionicons name="add" size={28} color={colors.accent} />
                </AnimatedPressable>
            </Animated.View>

            {/* Controls Row */}
            <View style={[styles.controlsRow, { backgroundColor: colors.background }]}>
                {/* Location */}
                <View style={styles.locationSection}>
                    <Ionicons name="location-sharp" size={16} color={colors.accent} />
                    <Text
                        style={[styles.locationText, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                        numberOfLines={1}
                    >
                        {locationText}
                    </Text>
                </View>

                {/* Action buttons */}
                <View style={styles.actionButtons}>
                    {/* Filter */}
                    <Pressable
                        style={[styles.controlBtn, { borderColor: colors.border }]}
                        onPress={() => setFilterVisible(true)}
                    >
                        <Ionicons name="filter" size={16} color={colors.text} />
                        <Text style={[styles.controlBtnText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Filter
                        </Text>
                        {activeFilterCount > 0 && (
                            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                                <Text style={styles.badgeText}>{activeFilterCount}</Text>
                            </View>
                        )}
                    </Pressable>

                    {/* Sort */}
                    <Pressable
                        style={[styles.controlBtn, { borderColor: colors.border }]}
                        onPress={() => setSortVisible(true)}
                    >
                        <Ionicons name="swap-vertical" size={16} color={colors.text} />
                        <Text style={[styles.controlBtnText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Sort
                        </Text>
                    </Pressable>

                    {/* View toggle */}
                    <Pressable
                        style={[styles.viewToggle, { borderColor: colors.border }]}
                        onPress={toggleViewMode}
                    >
                        <Ionicons
                            name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
                            size={20}
                            color={colors.text}
                        />
                    </Pressable>
                </View>
            </View>

            {/* Task Feed */}
            {viewMode === 'grid' ? (
                <FlatList
                    key="grid"
                    data={processedTasks}
                    renderItem={renderGridCard}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                    columnWrapperStyle={styles.gridRow}
                    initialNumToRender={8}
                    maxToRenderPerBatch={6}
                    windowSize={5}
                    removeClippedSubviews
                />
            ) : (
                <FlatList
                    key="list"
                    data={processedTasks}
                    renderItem={renderListCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={6}
                    maxToRenderPerBatch={4}
                    windowSize={5}
                    removeClippedSubviews
                />
            )}

            {/* Sheets */}
            <FilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filters={filters}
                onApply={setFilters}
            />
            <SortSheet
                visible={sortVisible}
                onClose={() => setSortVisible(false)}
                sortConfig={sortConfig}
                onApply={setSortConfig}
            />

            {/* Task Detail */}
            {selectedTask && (
                <TaskDetailSheet
                    task={selectedTask}
                    visible={!!selectedTask}
                    onClose={() => setSelectedTask(null)}
                    distanceKm={getDistanceKm(selectedTask)}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.xl,
        borderBottomLeftRadius: BorderRadius.xl,
        borderBottomRightRadius: BorderRadius.xl,
    },
    headerTitle: {
        fontSize: FontSize.xxxl,
        color: '#FFFFFF',
    },
    fab: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsRow: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    locationText: {
        flex: 1,
        fontSize: FontSize.sm,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    controlBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        gap: Spacing.xs,
    },
    controlBtnText: {
        fontSize: FontSize.sm,
    },
    badge: {
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    viewToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    grid: {
        paddingHorizontal: Spacing.xs,
        paddingBottom: Spacing.huge,
        paddingTop: Spacing.xs,
    },
    gridRow: {
        justifyContent: 'space-between',
    },
    list: {
        paddingBottom: Spacing.huge,
        paddingTop: Spacing.xs,
    },
});
