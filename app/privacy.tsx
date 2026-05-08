/**
 * privacy.tsx — Privacy & Data Policy page.
 *
 * Sections:
 *  1. Privacy Overview
 *  2. Data We Collect
 *  3. Location Sharing
 *  4. Account Safety
 *  5. Contact / Support
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    colorKey: string;
    content: string;
};

const SECTIONS: Section[] = [
    {
        id: 'overview',
        icon: 'shield-checkmark',
        title: 'Privacy Overview',
        colorKey: '#6C47FF',
        content:
            'Chhehchhawl is built with your privacy in mind. We collect only the information necessary to provide our task-matching service. We do not sell your personal data to third parties, and we never will.\n\nYour data is stored securely on Supabase (hosted on AWS) with row-level security policies ensuring you can only access your own data.',
    },
    {
        id: 'data',
        icon: 'server',
        title: 'Data We Collect',
        colorKey: '#2B6CB0',
        content:
            '• Profile information: name, username, email/phone, profile photo, bio, location (state & district).\n\n• Task data: tasks you post or apply for, including descriptions, budgets, and media.\n\n• Messages: chat messages between task posters and taskers — stored securely and only visible to the two participants.\n\n• Location: your device location is used only when you explicitly share it in chat or when filtering tasks by distance. We do not track your location in the background.\n\n• Device info: Expo push token for in-app notifications (optional).',
    },
    {
        id: 'location',
        icon: 'location',
        title: 'Location Sharing',
        colorKey: '#2F855A',
        content:
            'Location is accessed only when you explicitly:\n\n1. Share your current location in a chat.\n2. Browse tasks (to show distance to tasks near you).\n3. Post a task with a location pin.\n\nLive location sharing is always opt-in and can be stopped at any time by either party. Location data from live sessions is deleted after the session ends.\n\nWe never track your background location or share it with advertisers.',
    },
    {
        id: 'safety',
        icon: 'lock-closed',
        title: 'Account Safety',
        colorKey: '#D69E2E',
        content:
            '• Authentication is handled by Supabase Auth — your password is never stored in plaintext.\n\n• All API calls are encrypted via HTTPS/TLS.\n\n• Row-level security (RLS) ensures users can only read or write their own data.\n\n• Chat rooms are private — only the poster and accepted tasker can view messages.\n\n• You can delete your account at any time by contacting support. All your data will be permanently removed within 30 days.',
    },
    {
        id: 'contact',
        icon: 'mail',
        title: 'Contact & Support',
        colorKey: '#E53E3E',
        content:
            'For privacy-related questions, data requests, or to report a concern:\n\n📧 Email: shibya2025@gmail.com\n\nWe aim to respond within 2 business days. For urgent issues, please mention "URGENT" in the subject line.\n\nThis privacy policy was last updated in May 2025.',
    },
];

function SectionCard({ section, colors }: { section: Section; colors: any }) {
    const [expanded, setExpanded] = useState(true);
    return (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: section.colorKey + '30' }]}>
            <Pressable
                style={styles.cardHeader}
                onPress={() => setExpanded(v => !v)}
            >
                <View style={[styles.iconCircle, { backgroundColor: section.colorKey + '18' }]}>
                    <Ionicons name={section.icon} size={20} color={section.colorKey} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                    {section.title}
                </Text>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                />
            </Pressable>
            {expanded && (
                <Text style={[styles.cardBody, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                    {section.content}
                </Text>
            )}
        </View>
    );
}

export default function PrivacyScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Privacy
                    </Text>
                    <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        How we handle your data
                    </Text>
                </View>
                <View style={[styles.headerBadge, { backgroundColor: '#6C47FF' + '18' }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#6C47FF" />
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <View style={[styles.hero, { backgroundColor: '#6C47FF' + '10', borderColor: '#6C47FF' + '25' }]}>
                    <Ionicons name="shield" size={36} color="#6C47FF" />
                    <Text style={[styles.heroTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Your Privacy Matters
                    </Text>
                    <Text style={[styles.heroBody, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                        We are committed to keeping your information safe, private, and never selling it to third parties.
                    </Text>
                </View>

                {/* Sections */}
                {SECTIONS.map(s => (
                    <SectionCard key={s.id} section={s} colors={colors} />
                ))}

                {/* Contact Button */}
                <TouchableOpacity
                    style={[styles.contactBtn, { backgroundColor: colors.accent }]}
                    onPress={() => Linking.openURL('mailto:shibya2025@gmail.com?subject=Privacy Inquiry')}
                    activeOpacity={0.8}
                >
                    <Ionicons name="mail" size={18} color="#FFF" />
                    <Text style={[styles.contactBtnText, { fontFamily: FontFamily.bold }]}>
                        Contact Privacy Team
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1, gap: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerContent: { flex: 1 },
    headerTitle: { fontSize: FontSize.xl },
    headerSub: { fontSize: FontSize.xs, marginTop: 1 },
    headerBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { padding: Spacing.lg, gap: Spacing.md },
    hero: {
        borderRadius: BorderRadius.xl, padding: Spacing.xl,
        alignItems: 'center', gap: Spacing.sm, borderWidth: 1, marginBottom: Spacing.sm,
    },
    heroTitle: { fontSize: FontSize.xl, textAlign: 'center' },
    heroBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
    card: {
        borderRadius: BorderRadius.lg, overflow: 'hidden',
        borderWidth: 1,
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md, gap: Spacing.md,
    },
    iconCircle: {
        width: 36, height: 36, borderRadius: 18,
        justifyContent: 'center', alignItems: 'center',
    },
    cardTitle: { flex: 1, fontSize: FontSize.md },
    cardBody: {
        paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
        fontSize: FontSize.sm, lineHeight: 22,
    },
    contactBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: Spacing.sm, paddingVertical: Spacing.md + 2,
        borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
    },
    contactBtnText: { color: '#FFF', fontSize: FontSize.md },
});
