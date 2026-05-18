/**
 * (tabs)/tasks.tsx — Task feed screen.
 *
 * Renders all available tasks in a FlatList (grid or list mode).
 * Features:
 *  • Filter by category, distance, urgency, status, and location (state + districts)
 *  • Sort by time, budget, distance, or urgency (SortSheet)
 *  • Toggle between grid / list layout
 *  • Distance calculation from the user's current location via `expo-location`
 *  • Auto-detects user's Indian state via GPS for location-aware filtering
 *  • Pull-to-refresh and perf-tuned FlatList props
 */

import { DEFAULT_FILTERS, FilterSheet, getActiveFilterCount, type FilterState } from '@/components/FilterSheet';
import { DEFAULT_SORT, SortSheet, type SortConfig } from '@/components/SortSheet';
import { TaskCard } from '@/components/TaskCard';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { INDIAN_STATES } from '@/constants/indian-locations';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { type Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useApplicantCountsQuery } from '@/hooks/use-application-queries';
import { MAX_APPLICANTS, useInfiniteTaskFeedQuery } from '@/hooks/use-task-queries';
import { haversine } from '@/utils/distance';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const URGENCY_ORDER = { urgent: 3, mid: 2, low: 1 };

/**
 * Attempts to match a geocoded `region` string (returned by expo-location's
 * reverseGeocodeAsync) to a canonical state name in INDIAN_STATES.
 *
 * Strategy: normalise both strings (lower-case, strip punctuation/spaces) and
 * check for substring containment in either direction, then fall back to
 * checking individual words.
 */
function matchRegionToState(region: string | null | undefined): string {
    if (!region) return '';

    const normalise = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const normRegion = normalise(region);

    // 1. Exact or substring match
    for (const s of INDIAN_STATES) {
        const normState = normalise(s.name);
        if (normRegion === normState || normRegion.includes(normState) || normState.includes(normRegion)) {
            return s.name;
        }
    }

    // 2. Word-level match (e.g. "Mizoram Pradesh" → "Mizoram")
    const regionWords = region.toLowerCase().split(/\W+/).filter(Boolean);
    for (const s of INDIAN_STATES) {
        const stateWords = s.name.toLowerCase().split(/\W+/).filter(Boolean);
        if (stateWords.some((w) => regionWords.includes(w))) {
            return s.name;
        }
    }

    return '';
}



export default function HomeScreen() {
    const { colors } = useTheme();
    const { isAuthenticated } = useAuth();
    const router = useRouter();

    // ── Paginated task feed ──
    const {
        data: feedData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isRefetching,
        refetch,
    } = useInfiniteTaskFeedQuery(isAuthenticated);

    // Flatten all pages into a single array for filtering/sorting
    const tasks = useMemo(() => (feedData?.pages ?? []).flat(), [feedData]);

    // Fetch applicant counts to hide tasks that have hit the cap
    const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
    const { data: applicantCounts = {} } = useApplicantCountsQuery(taskIds);

    // ── State ──
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [sortConfig, setSortConfig] = useState<SortConfig>(DEFAULT_SORT);
    const [filterVisible, setFilterVisible] = useState(false);
    const [sortVisible, setSortVisible] = useState(false);
    const [locationText, setLocationText] = useState('Fetching location...');

    /** Detected Indian state name from GPS (empty string = unknown) */
    const [detectedState, setDetectedState] = useState('');

    // User coordinates for distance calculations
    const userCoords = useRef<{ latitude: number; longitude: number } | null>(null);

    // ── Location detection ──
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
                    // Build display text
                    const parts = [geo.name, geo.district, geo.city].filter(Boolean);
                    setLocationText(parts.join(', ') || 'Current Location');

                    // Detect state — expo-location puts state in `geo.region`
                    // Only store as a hint for the FilterSheet; do NOT auto-apply to
                    // filters so that all tasks are visible by default.
                    const matched = matchRegionToState(geo.region);
                    if (matched) {
                        setDetectedState(matched);
                    }
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
        fabScale.value = withTiming(0.92, { duration: 80 }, () => {
            fabScale.value = withTiming(1, { duration: 80 });
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
        // Hide tasks that have reached the applicant cap
        let result = tasks.filter(
            (t) => (applicantCounts[t.id] ?? 0) < MAX_APPLICANTS
        );

        // ── Filter: state ──
        // Matching strategy (in order of priority):
        //   1. task.locality contains a district name from the selected state
        //   2. task.locality contains the state name itself
        //   3. task.location (free-text) contains the state name or any district
        //   4. Task has NO location data at all → include it (can't determine location)
        //
        // Tasks are only excluded when they have location data that clearly belongs
        // to a DIFFERENT state — never exclude tasks with missing location data.
        if (filters.state) {
            const stateData = INDIAN_STATES.find((s) => s.name === filters.state);
            if (stateData) {
                const stateNorm = filters.state.toLowerCase();
                const districtNorms = stateData.districts.map((d) => d.toLowerCase());

                result = result.filter((t) => {
                    const localityNorm = t.locality?.toLowerCase().trim() ?? '';
                    const locationNorm = t.location?.toLowerCase().trim() ?? '';

                    // No location info → include (can't determine, don't hide)
                    if (!localityNorm && !locationNorm) return true;

                    // Check locality against all district names of the state
                    if (localityNorm && districtNorms.some((d) => localityNorm.includes(d) || d.includes(localityNorm))) return true;

                    // Check locality against the state name itself
                    if (localityNorm && (localityNorm.includes(stateNorm) || stateNorm.includes(localityNorm))) return true;

                    // Check free-text location field against state name
                    if (locationNorm && locationNorm.includes(stateNorm)) return true;

                    // Check free-text location field against any district name
                    if (locationNorm && districtNorms.some((d) => locationNorm.includes(d) || d.includes(locationNorm))) return true;

                    return false;
                });
            }
        }

        // ── Filter: districts ──
        // Only narrows further when a state is selected AND at least one district chosen.
        // Tasks with no location data still pass through.
        if (filters.state && filters.districts.length > 0) {
            const selectedDistrictNorms = filters.districts.map((d) => d.toLowerCase());
            result = result.filter((t) => {
                const localityNorm = t.locality?.toLowerCase().trim() ?? '';
                const locationNorm = t.location?.toLowerCase().trim() ?? '';

                // No location info → include
                if (!localityNorm && !locationNorm) return true;

                if (localityNorm && selectedDistrictNorms.some((d) => localityNorm.includes(d) || d.includes(localityNorm))) return true;
                if (locationNorm && selectedDistrictNorms.some((d) => locationNorm.includes(d) || d.includes(locationNorm))) return true;

                return false;
            });
        }

        // ── Filter: categories ──
        if (filters.categories.length > 0) {
            result = result.filter((t) =>
                t.categories.some((c) => filters.categories.includes(c))
            );
        }

        // ── Filter: urgencies ──
        if (filters.urgencies.length > 0) {
            result = result.filter(
                (t) => t.urgency && filters.urgencies.includes(t.urgency)
            );
        }

        // ── Filter: statuses ──
        if (filters.statuses.length > 0) {
            result = result.filter((t) => filters.statuses.includes(t.status));
        }

        // ── Filter: distance range ──
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

        // ── Sort ──
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
    }, [tasks, filters, sortConfig, getDistanceKm, applicantCounts]);

    // ── View toggle ──
    const toggleViewMode = () => {
        setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
    };

    const activeFilterCount = getActiveFilterCount(filters);

    // ── Location display text with detected state hint ──
    const locationDisplayText = useMemo(() => {
        if (detectedState && locationText !== 'Fetching location...' && locationText !== 'Location unavailable') {
            return locationText;
        }
        return locationText;
    }, [locationText, detectedState]);

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
            <View style={[styles.header, { backgroundColor: colors.accent }]}>
                <Text style={[styles.headerTitle, { fontFamily: FontFamily.bold }]}>Find Task</Text>
                <AnimatedPressable
                    style={[styles.fab, { backgroundColor: colors.background }, fabAnimatedStyle]}
                    onPress={handleCreateTask}
                >
                    <Ionicons name="add" size={28} color={colors.accent} />
                </AnimatedPressable>
            </View>

            {/* Controls Row */}
            <View style={[styles.controlsRow, { backgroundColor: colors.background }]}>
                {/* Location */}
                <View style={styles.locationSection}>
                    <Ionicons name="location-sharp" size={16} color={colors.accent} />
                    <Text
                        style={[styles.locationText, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}
                        numberOfLines={1}
                    >
                        {locationDisplayText}
                    </Text>
                    {/* Show detected state chip if a state is being filtered */}
                    {filters.state ? (
                        <View style={[styles.stateChip, { backgroundColor: colors.accentLight }]}>
                            <Text style={[styles.stateChipText, { color: colors.accent, fontFamily: FontFamily.semiBold }]}>
                                {filters.state}
                            </Text>
                        </View>
                    ) : null}
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
                    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                    onEndReachedThreshold={0.4}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching && !isFetchingNextPage}
                            onRefresh={refetch}
                            tintColor={colors.accent}
                        />
                    }
                    ListFooterComponent={
                        isFetchingNextPage
                            ? <ActivityIndicator size="small" color={colors.accent} style={styles.feedFooter} />
                            : null
                    }
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
                    onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
                    onEndReachedThreshold={0.4}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefetching && !isFetchingNextPage}
                            onRefresh={refetch}
                            tintColor={colors.accent}
                        />
                    }
                    ListFooterComponent={
                        isFetchingNextPage
                            ? <ActivityIndicator size="small" color={colors.accent} style={styles.feedFooter} />
                            : null
                    }
                />
            )}

            {/* Sheets */}
            <FilterSheet
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                filters={filters}
                onApply={setFilters}
                detectedState={detectedState}
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
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
        borderRadius: 0,
    },
    headerTitle: {
        fontSize: FontSize.xxl,
        color: '#FFFFFF',
    },
    fab: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsRow: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
        gap: Spacing.xs,
    },
    locationSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: 2,
    },
    locationText: {
        flex: 1,
        fontSize: FontSize.sm,
    },
    stateChip: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    stateChipText: {
        fontSize: FontSize.xs,
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
        paddingTop: 2,
    },
    gridRow: {
        justifyContent: 'space-between',
    },
    list: {
        paddingBottom: Spacing.huge,
        paddingTop: 2,
    },
    feedFooter: {
        paddingVertical: Spacing.lg,
        alignItems: 'center' as const,
    },
});
