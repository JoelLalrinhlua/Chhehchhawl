/**
 * FilterSheet.tsx — Bottom-sheet modal for filtering the task feed.
 *
 * Allows the user to narrow results by:
 *  • Category (multi-select chip list)
 *  • Maximum distance (slider)
 *  • Urgency level (low / mid / urgent)
 *  • Task status (open / assigned / in-progress / completed / closed)
 *  • Location — State (single-select) + Districts (multi-select)
 *
 * Exports `FilterState`, `DEFAULT_FILTERS`, `getActiveFilterCount`, and `CATEGORIES`.
 */

import { INDIAN_STATES, getDistrictsForState } from '@/constants/indian-locations';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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

const STATE_NAMES = INDIAN_STATES.map((s) => s.name);

export interface FilterState {
    categories: string[];
    distanceRange: string;
    urgencies: string[];
    statuses: string[];
    /** Selected Indian state name, or '' for any */
    state: string;
    /** Selected district names within the chosen state */
    districts: string[];
}

export const DEFAULT_FILTERS: FilterState = {
    categories: [],
    distanceRange: 'any',
    urgencies: [],
    statuses: [],
    state: '',
    districts: [],
};

export function getActiveFilterCount(filters: FilterState): number {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.distanceRange !== 'any') count++;
    if (filters.urgencies.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.state) count++;
    if (filters.districts.length > 0) count++;
    return count;
}

interface FilterSheetProps {
    visible: boolean;
    onClose: () => void;
    filters: FilterState;
    onApply: (filters: FilterState) => void;
    /** Detected state from GPS — pre-fills state picker if no state is chosen yet */
    detectedState?: string;
}

// ── State Picker Modal ──────────────────────────────────────────────────────

interface StatePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (state: string) => void;
    selected: string;
}

function StatePickerModal({ visible, onClose, onSelect, selected }: StatePickerModalProps) {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');

    const filtered = useMemo(
        () =>
            search.trim()
                ? STATE_NAMES.filter((s) => s.toLowerCase().includes(search.toLowerCase()))
                : STATE_NAMES,
        [search]
    );

    const handleSelect = useCallback(
        (name: string) => {
            onSelect(name);
            setSearch('');
            onClose();
        },
        [onSelect, onClose]
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[spStyles.overlay, { backgroundColor: colors.overlay }]}>
                <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
                <View style={[spStyles.sheet, { backgroundColor: colors.surface }]}>
                    <View style={[spStyles.handle, { backgroundColor: colors.textMuted }]} />
                    <Text style={[spStyles.title, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Select State
                    </Text>

                    {/* Search box */}
                    <View style={[spStyles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="search" size={16} color={colors.textMuted} />
                        <TextInput
                            style={[spStyles.searchInput, { color: colors.text, fontFamily: FontFamily.regular }]}
                            placeholder="Search state..."
                            placeholderTextColor={colors.textMuted}
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                        {search.length > 0 && (
                            <Pressable onPress={() => setSearch('')}>
                                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                            </Pressable>
                        )}
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={spStyles.list}>
                        {/* Any option */}
                        <TouchableOpacity
                            style={[
                                spStyles.item,
                                selected === '' && { backgroundColor: colors.accentLight },
                            ]}
                            onPress={() => handleSelect('')}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="globe-outline"
                                size={16}
                                color={selected === '' ? colors.accent : colors.textMuted}
                            />
                            <Text
                                style={[
                                    spStyles.itemText,
                                    {
                                        color: selected === '' ? colors.accent : colors.text,
                                        fontFamily: selected === '' ? FontFamily.bold : FontFamily.regular,
                                    },
                                ]}
                            >
                                Any State (All India)
                            </Text>
                            {selected === '' && (
                                <Ionicons name="checkmark" size={16} color={colors.accent} style={spStyles.check} />
                            )}
                        </TouchableOpacity>

                        {filtered.map((name) => {
                            const active = selected === name;
                            return (
                                <TouchableOpacity
                                    key={name}
                                    style={[
                                        spStyles.item,
                                        active && { backgroundColor: colors.accentLight },
                                    ]}
                                    onPress={() => handleSelect(name)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name="location-outline"
                                        size={16}
                                        color={active ? colors.accent : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            spStyles.itemText,
                                            {
                                                color: active ? colors.accent : colors.text,
                                                fontFamily: active ? FontFamily.bold : FontFamily.regular,
                                            },
                                        ]}
                                    >
                                        {name}
                                    </Text>
                                    {active && (
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color={colors.accent}
                                            style={spStyles.check}
                                        />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        <View style={{ height: 32 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const spStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        paddingTop: Spacing.md,
        maxHeight: SCREEN_HEIGHT * 0.75,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize.xl,
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.xl,
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        paddingVertical: 0,
    },
    list: {
        paddingHorizontal: Spacing.md,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        gap: Spacing.sm,
        marginBottom: 2,
    },
    itemText: {
        flex: 1,
        fontSize: FontSize.md,
    },
    check: {
        marginLeft: 'auto',
    },
});

// ── Main FilterSheet ────────────────────────────────────────────────────────

export function FilterSheet({ visible, onClose, filters, onApply, detectedState }: FilterSheetProps) {
    const { colors } = useTheme();
    const translateY = useSharedValue(0);
    const [local, setLocal] = useState<FilterState>(filters);
    const [statePickerVisible, setStatePickerVisible] = useState(false);

    // Districts available for the currently selected state
    const availableDistricts = useMemo(
        () => (local.state ? getDistrictsForState(local.state) : []),
        [local.state]
    );

    // Sync local state when opening
    React.useEffect(() => {
        if (visible) {
            translateY.value = 0;
            // If no state is set yet and we have a detected state, pre-fill it
            setLocal((prev) => ({
                ...filters,
                state: filters.state || (detectedState ?? ''),
                districts: filters.state ? filters.districts : [],
            }));
        }
    }, [visible, filters, detectedState]);

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

    const toggleDistrict = (d: string) => {
        setLocal((prev) => ({
            ...prev,
            districts: prev.districts.includes(d)
                ? prev.districts.filter((x) => x !== d)
                : [...prev.districts, d],
        }));
    };

    const handleStateSelect = (stateName: string) => {
        setLocal((prev) => ({
            ...prev,
            state: stateName,
            districts: [], // reset districts when state changes
        }));
    };

    const handleReset = () => setLocal(DEFAULT_FILTERS);

    const handleApply = () => {
        onApply(local);
        onClose();
    };

    if (!visible) return null;

    return (
        <>
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
                                {/* ── Location ── */}
                                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                                    Location
                                </Text>

                                {/* State selector */}
                                <Pressable
                                    style={[
                                        styles.stateSelector,
                                        {
                                            backgroundColor: local.state ? colors.accentLight : colors.card,
                                            borderColor: local.state ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={() => setStatePickerVisible(true)}
                                >
                                    <Ionicons
                                        name="location"
                                        size={16}
                                        color={local.state ? colors.accent : colors.textMuted}
                                    />
                                    <Text
                                        style={[
                                            styles.stateSelectorText,
                                            {
                                                color: local.state ? colors.accent : colors.textMuted,
                                                fontFamily: local.state ? FontFamily.semiBold : FontFamily.regular,
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {local.state || 'Select State (Any)'}
                                    </Text>
                                    {detectedState && !local.state && (
                                        <Text style={[styles.detectedBadge, { color: colors.textMuted }]}>
                                            Detected: {detectedState}
                                        </Text>
                                    )}
                                    <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                                </Pressable>

                                {/* Auto-detect hint */}
                                {detectedState && !local.state && (
                                    <Pressable
                                        style={[styles.useDetectedBtn, { borderColor: colors.border }]}
                                        onPress={() => handleStateSelect(detectedState)}
                                    >
                                        <Ionicons name="navigate" size={13} color={colors.accent} />
                                        <Text style={[styles.useDetectedText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                            Use my location: {detectedState}
                                        </Text>
                                    </Pressable>
                                )}

                                {/* District chips — only shown when a state is selected */}
                                {local.state !== '' && availableDistricts.length > 0 && (
                                    <>
                                        <View style={styles.districtHeader}>
                                            <Text style={[styles.districtLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                                                Districts / Cities
                                            </Text>
                                            {local.districts.length > 0 && (
                                                <Pressable onPress={() => setLocal((p) => ({ ...p, districts: [] }))}>
                                                    <Text style={[styles.clearDistrictsText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                                                        Clear
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>
                                        <View style={styles.chipGrid}>
                                            {availableDistricts.map((d) => {
                                                const active = local.districts.includes(d);
                                                return (
                                                    <Pressable
                                                        key={d}
                                                        style={[
                                                            styles.chip,
                                                            {
                                                                backgroundColor: active ? colors.accent : colors.card,
                                                                borderColor: active ? colors.accent : colors.border,
                                                            },
                                                        ]}
                                                        onPress={() => toggleDistrict(d)}
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
                                                            {d}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </>
                                )}

                                {/* ── Category ── */}
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

                                {/* ── Distance ── */}
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

                                {/* ── Urgency ── */}
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

                                {/* ── Status ── */}
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

            {/* State Picker — rendered outside the bottom-sheet so it stacks on top */}
            <StatePickerModal
                visible={statePickerVisible}
                onClose={() => setStatePickerVisible(false)}
                onSelect={handleStateSelect}
                selected={local.state}
            />
        </>
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
        maxHeight: SCREEN_HEIGHT * 0.82,
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
        maxHeight: SCREEN_HEIGHT * 0.62,
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
    // ── Location ──
    stateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    stateSelectorText: {
        flex: 1,
        fontSize: FontSize.md,
    },
    detectedBadge: {
        fontSize: FontSize.xs,
    },
    useDetectedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    useDetectedText: {
        fontSize: FontSize.sm,
    },
    districtHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    districtLabel: {
        fontSize: FontSize.sm,
    },
    clearDistrictsText: {
        fontSize: FontSize.sm,
    },
    // ── Chips ──
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
