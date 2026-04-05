/**
 * suggestions.tsx — User feedback & suggestion submission screen.
 *
 * Features:
 *  - Category chips (Bug Report, Feature Request, UI/UX, Performance, Other)
 *  - Priority selector (Low / Medium / High with colored dot indicators)
 *  - Subject + multi-line description with live character count
 *  - Animated submit with loading state
 *  - Success state with animated checkmark + thank-you message
 *  - Saves to the `suggestions` table in Supabase
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
    ZoomIn,
} from 'react-native-reanimated';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'bug_report' | 'feature_request' | 'ui_ux' | 'performance' | 'other';

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
    { key: 'bug_report',      label: 'Bug Report',       icon: 'bug-outline' },
    { key: 'feature_request', label: 'Feature Request',  icon: 'bulb-outline' },
    { key: 'ui_ux',           label: 'UI / UX',          icon: 'color-palette-outline' },
    { key: 'performance',     label: 'Performance',      icon: 'flash-outline' },
    { key: 'other',           label: 'Other',            icon: 'chatbubble-ellipses-outline' },
];

const MAX_SUBJECT     = 80;
const MAX_DESCRIPTION = 500;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SuggestionsScreen() {
    const router           = useRouter();
    const { user }         = useAuth();
    const { colors, isDark } = useTheme();

    const [category,    setCategory]    = useState<Category>('feature_request');
    const [subject,     setSubject]     = useState('');
    const [description, setDescription] = useState('');
    const [loading,     setLoading]     = useState(false);
    const [submitted,   setSubmitted]   = useState(false);
    const [error,       setError]       = useState<string | null>(null);

    const submitScale = useSharedValue(1);
    const checkScale  = useSharedValue(0);

    const submitAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: submitScale.value }],
    }));
    const checkAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: checkScale.value }],
    }));

    // ── Validation ─────────────────────────────────────────────────────────
    const isValid = subject.trim().length >= 3 && description.trim().length >= 10;

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!isValid || !user) return;

        setLoading(true);
        setError(null);

        submitScale.value = withTiming(0.95, { duration: 80 });

        const { error: sbError } = await supabase.from('suggestions').insert({
            user_id:     user.id,
            category,
            subject:     subject.trim(),
            description: description.trim(),
        });

        setLoading(false);

        if (sbError) {
            submitScale.value = withTiming(1, { duration: 80 });
            setError(sbError.message || 'Failed to submit. Please try again.');
            return;
        }

        // Success animation
        submitScale.value = withTiming(1, { duration: 80 });
        checkScale.value  = withSequence(
            withSpring(1.2, { damping: 8, stiffness: 200 }),
            withSpring(1,   { damping: 12, stiffness: 200 }),
        );
        setSubmitted(true);
    };

    const styles = makeStyles(colors, isDark);

    // ── Success State ──────────────────────────────────────────────────────
    if (submitted) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Suggestions</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Animated.View entering={FadeIn.duration(400)} style={styles.successContainer}>
                    <Animated.View style={[styles.checkCircle, { backgroundColor: colors.accent + '20' }, checkAnimStyle]}>
                        <Ionicons name="checkmark-circle" size={72} color={colors.accent} />
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                        <Text style={[styles.successTitle, { color: colors.text }]}>
                            Thank You! 🎉
                        </Text>
                        <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
                            Your feedback has been received. We review all submissions and use them to improve Chhehchhawl.
                        </Text>
                    </Animated.View>

                    <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                        <TouchableOpacity
                            style={[styles.doneBtn, { backgroundColor: colors.accent }]}
                            onPress={() => router.back()}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.doneBtnText}>Back to Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.anotherBtn}
                            onPress={() => {
                                setSubmitted(false);
                                setSubject('');
                                setDescription('');
                                setCategory('feature_request');
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.anotherBtnText, { color: colors.textSecondary }]}>
                                Submit another suggestion
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </View>
        );
    }

    // ── Form ───────────────────────────────────────────────────────────────
    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Suggestions</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Intro Banner */}
                <Animated.View entering={FadeInDown.delay(50).duration(350)} style={[styles.banner, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' }]}>
                    <Ionicons name="sparkles" size={20} color={colors.accent} />
                    <Text style={[styles.bannerText, { color: colors.accent }]}>
                        Your feedback shapes Chhehchhawl. We read every submission!
                    </Text>
                </Animated.View>

                {/* Category */}
                <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Category</Text>
                    <View style={styles.chipRow}>
                        {CATEGORIES.map((cat) => {
                            const active = category === cat.key;
                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[
                                        styles.chip,
                                        {
                                            backgroundColor: active ? colors.accent : colors.card,
                                            borderColor:     active ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={() => setCategory(cat.key)}
                                    activeOpacity={0.75}
                                >
                                    <Ionicons
                                        name={cat.icon as any}
                                        size={14}
                                        color={active ? '#FFF' : colors.textSecondary}
                                    />
                                    <Text style={[styles.chipText, { color: active ? '#FFF' : colors.text }]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>

                {/* Priority section removed */}

                {/* Subject */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                    <View style={styles.labelRow}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                            Subject <Text style={{ color: colors.accent }}>*</Text>
                        </Text>
                        <Text style={[styles.charCount, { color: subject.length > MAX_SUBJECT * 0.85 ? colors.statusOrange : colors.textMuted }]}>
                            {subject.length}/{MAX_SUBJECT}
                        </Text>
                    </View>
                    <TextInput
                        style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                        placeholder="Brief title of your suggestion…"
                        placeholderTextColor={colors.textMuted}
                        value={subject}
                        onChangeText={(t) => { setSubject(t.slice(0, MAX_SUBJECT)); setError(null); }}
                        maxLength={MAX_SUBJECT}
                        returnKeyType="next"
                    />
                </Animated.View>

                {/* Description */}
                <Animated.View entering={FadeInDown.delay(250).duration(350)}>
                    <View style={styles.labelRow}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                            Description <Text style={{ color: colors.accent }}>*</Text>
                        </Text>
                        <Text style={[styles.charCount, { color: description.length > MAX_DESCRIPTION * 0.85 ? colors.statusOrange : colors.textMuted }]}>
                            {description.length}/{MAX_DESCRIPTION}
                        </Text>
                    </View>
                    <TextInput
                        style={[
                            styles.textInput,
                            styles.descriptionInput,
                            { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                        ]}
                        placeholder="Describe your suggestion in detail. What problem does it solve? What would you like to see?"
                        placeholderTextColor={colors.textMuted}
                        value={description}
                        onChangeText={(t) => { setDescription(t.slice(0, MAX_DESCRIPTION)); setError(null); }}
                        maxLength={MAX_DESCRIPTION}
                        multiline
                        textAlignVertical="top"
                    />
                    {description.length < 10 && description.length > 0 && (
                        <Text style={[styles.hintText, { color: colors.textMuted }]}>
                            At least 10 characters required
                        </Text>
                    )}
                </Animated.View>

                {/* Error */}
                {error && (
                    <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBanner, { backgroundColor: '#F44336' + '20', borderColor: '#F44336' + '50' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                        <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
                    </Animated.View>
                )}

                {/* Submit */}
                {/* Submit — outer wrapper for entering anim, inner for press scale */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                    <Animated.View style={submitAnimStyle}>
                        <TouchableOpacity
                            style={[
                                styles.submitBtn,
                                {
                                    backgroundColor: isValid ? colors.accent : colors.card,
                                    borderColor:     isValid ? colors.accent : colors.border,
                                },
                            ]}
                            onPress={handleSubmit}
                            disabled={!isValid || loading}
                            activeOpacity={0.85}
                            onPressIn={() => { submitScale.value = withTiming(0.97, { duration: 60 }); }}
                            onPressOut={() => { submitScale.value = withTiming(1, { duration: 60 }); }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons
                                        name="paper-plane"
                                        size={18}
                                        color={isValid ? '#FFF' : colors.textMuted}
                                    />
                                    <Text style={[styles.submitBtnText, { color: isValid ? '#FFF' : colors.textMuted }]}>
                                        Submit Suggestion
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>

                <Text style={[styles.footerNote, { color: colors.textMuted }]}>
                    Submissions are anonymous to other users. Our team reviews all feedback regularly.
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: any, _isDark: boolean) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingTop: Platform.OS === 'ios' ? 60 : 44,
            paddingBottom: Spacing.md,
        },
        backBtn: {
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            fontSize: FontSize.lg,
            fontFamily: FontFamily.bold,
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.huge,
            gap: Spacing.lg,
        },
        banner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
        },
        bannerText: {
            flex: 1,
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
            lineHeight: 20,
        },
        sectionLabel: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.semiBold,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginBottom: Spacing.sm,
        },
        chipRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.sm,
        },
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs + 2,
            borderRadius: BorderRadius.full,
            borderWidth: 1.5,
        },
        chipText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
        priorityRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
        },
        priorityBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1.5,
        },
        priorityDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
        },
        priorityText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.semiBold,
        },
        labelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: Spacing.sm,
        },
        charCount: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
        },
        textInput: {
            borderRadius: BorderRadius.md,
            borderWidth: 1.5,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            fontSize: FontSize.md,
            fontFamily: FontFamily.regular,
        },
        descriptionInput: {
            height: 160,
            paddingTop: Spacing.md,
        },
        hintText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            marginTop: 4,
        },
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
        },
        errorText: {
            flex: 1,
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
        submitBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            height: 56,
            borderRadius: BorderRadius.lg,
            borderWidth: 1.5,
            marginTop: Spacing.sm,
        },
        submitBtnText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        footerNote: {
            textAlign: 'center',
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            lineHeight: 18,
            paddingHorizontal: Spacing.lg,
        },
        // Success state
        successContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.xxxl,
            gap: Spacing.xxl,
        },
        checkCircle: {
            width: 120,
            height: 120,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
        },
        successTitle: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
            textAlign: 'center',
            marginBottom: Spacing.sm,
        },
        successSubtitle: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            lineHeight: 24,
        },
        doneBtn: {
            height: 56,
            borderRadius: BorderRadius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.xxxl,
            marginBottom: Spacing.md,
        },
        doneBtnText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        anotherBtn: {
            alignItems: 'center',
            padding: Spacing.sm,
        },
        anotherBtnText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
        // statusOrange
        statusOrange: {
            color: '#FF9800',
        },
    });
