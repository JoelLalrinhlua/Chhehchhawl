/**
 * help-center.tsx — Help Center & FAQ page.
 *
 * Sections: Getting Started, Task Posting, Tasker Guide,
 *           Account & Payment, Report a Problem, Contact Support.
 * FAQs are expandable accordion cards.
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Types ──────────────────────────────────────────────────────
type FAQ = { q: string; a: string };
type HelpSection = {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    color: string;
    faqs: FAQ[];
};

// ── Content ────────────────────────────────────────────────────
const SECTIONS: HelpSection[] = [
    {
        id: 'getting-started',
        icon: 'rocket',
        title: 'Getting Started',
        color: '#6C47FF',
        faqs: [
            {
                q: 'What is Chhehchhawl?',
                a: 'Chhehchhawl is a local task-marketplace app. Task posters list jobs they need done, and taskers apply to complete them for a fee.',
            },
            {
                q: 'How do I create an account?',
                a: 'Download the app, tap "Sign Up", and register with your email or phone number. Complete your profile to start posting or applying for tasks.',
            },
            {
                q: 'Is Chhehchhawl free to use?',
                a: 'Yes! Creating an account, posting tasks, and applying for tasks is completely free. Payments happen directly between poster and tasker via UPI.',
            },
            {
                q: 'Which areas does the app serve?',
                a: 'Currently focused on Mizoram, India. We plan to expand to more regions based on community demand.',
            },
        ],
    },
    {
        id: 'posting',
        icon: 'create',
        title: 'Posting a Task',
        color: '#2B6CB0',
        faqs: [
            {
                q: 'How do I post a task?',
                a: 'Tap the "+" button or go to "Post Task" from the home screen. Fill in the title, description, budget, location, and category, then submit.',
            },
            {
                q: 'Can I edit my task after posting?',
                a: 'Yes — go to your posted task, tap the edit (pencil) icon, make your changes and save. Note: editing is locked once a tasker is assigned.',
            },
            {
                q: 'How many applicants can apply to my task?',
                a: 'Up to 7 applicants can apply per task. Once the cap is reached, the task is hidden from the feed until you accept someone.',
            },
            {
                q: 'How do I accept a tasker?',
                a: 'Open your task, tap "View Applicants", review the applicants, and tap "Accept" on the one you want. A private chat room is automatically created.',
            },
        ],
    },
    {
        id: 'tasker',
        icon: 'briefcase',
        title: 'Tasker Guide',
        color: '#2F855A',
        faqs: [
            {
                q: 'How do I apply for a task?',
                a: 'Browse tasks in the "Find Task" tab, tap any task to view details, then tap "Apply". You can optionally add a message to your application.',
            },
            {
                q: 'How will I know if I am accepted?',
                a: 'You\'ll receive a notification when the poster accepts your application. A chat room with the poster will also appear in your "Messages" tab.',
            },
            {
                q: 'How do I mark a task as complete?',
                a: 'Open the chat room for the task, tap "Mark as Complete". The poster will then be prompted to pay via UPI.',
            },
            {
                q: 'When do I receive payment?',
                a: 'Payments are made directly via UPI after you mark the task complete. Confirm receipt in the chat to finalize the task.',
            },
        ],
    },
    {
        id: 'payment',
        icon: 'wallet',
        title: 'Account & Payment',
        color: '#D69E2E',
        faqs: [
            {
                q: 'How does payment work?',
                a: 'Payments are peer-to-peer via UPI. The tasker marks the task complete → the poster pays via their UPI app → the tasker confirms receipt → task is closed.',
            },
            {
                q: 'How do I set my UPI ID?',
                a: 'Go to Profile → Edit Profile and enter your UPI ID. This is shared with the poster only when you mark a task complete.',
            },
            {
                q: 'What if the poster refuses to pay?',
                a: 'Please report the issue via "Report a Problem" below. We take payment disputes seriously and will review your case.',
            },
            {
                q: 'How do I delete my account?',
                a: 'Contact us at shibya2025@gmail.com with your registered email/phone. All data will be permanently deleted within 30 days.',
            },
        ],
    },
    {
        id: 'chat',
        icon: 'chatbubble-ellipses',
        title: 'Chat & Communication',
        color: '#319795',
        faqs: [
            {
                q: 'How do I share my location in chat?',
                a: 'In a chat room, tap the "+" attachment button, then choose "Location" to share your current position, or tap "Choose on Map" to pick a custom point.',
            },
            {
                q: 'What is Live Location sharing?',
                a: 'Taskers can offer to share their live GPS position with the poster, useful when navigating to a task site. Either party can stop it at any time.',
            },
            {
                q: 'Are my chats private?',
                a: 'Yes. Chat rooms are only visible to the task poster and the accepted tasker. No one else, including Chhehchhawl staff, can read your messages.',
            },
        ],
    },
];

// ── Components ─────────────────────────────────────────────────
function FAQItem({ faq, colors }: { faq: FAQ; colors: any }) {
    const [open, setOpen] = useState(false);
    return (
        <Pressable
            style={[styles.faqItem, { borderColor: colors.border }]}
            onPress={() => setOpen(v => !v)}
        >
            <View style={styles.faqHeader}>
                <Text style={[styles.faqQ, { color: colors.text, fontFamily: FontFamily.medium }]}>
                    {faq.q}
                </Text>
                <Ionicons
                    name={open ? 'remove-circle' : 'add-circle'}
                    size={20}
                    color={colors.accent}
                />
            </View>
            {open && (
                <Text style={[styles.faqA, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                    {faq.a}
                </Text>
            )}
        </Pressable>
    );
}

function HelpSectionCard({ section, colors }: { section: HelpSection; colors: any }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <Pressable style={styles.sectionHeader} onPress={() => setExpanded(v => !v)}>
                <View style={[styles.sectionIcon, { backgroundColor: section.color + '18' }]}>
                    <Ionicons name={section.icon} size={20} color={section.color} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                    {section.title}
                </Text>
                <View style={[styles.faqCountBadge, { backgroundColor: section.color + '15' }]}>
                    <Text style={[styles.faqCountText, { color: section.color }]}>
                        {section.faqs.length}
                    </Text>
                </View>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                />
            </Pressable>
            {expanded && (
                <View style={[styles.faqList, { borderTopColor: colors.border }]}>
                    {section.faqs.map((faq, i) => (
                        <FAQItem key={i} faq={faq} colors={colors} />
                    ))}
                </View>
            )}
        </View>
    );
}

// ── Screen ─────────────────────────────────────────────────────
export default function HelpCenterScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');

    const filteredSections = search.trim()
        ? SECTIONS.map(s => ({
            ...s,
            faqs: s.faqs.filter(
                f =>
                    f.q.toLowerCase().includes(search.toLowerCase()) ||
                    f.a.toLowerCase().includes(search.toLowerCase())
            ),
        })).filter(s => s.faqs.length > 0)
        : SECTIONS;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Help Center
                    </Text>
                    <Text style={[styles.headerSub, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        Answers & Support
                    </Text>
                </View>
                <View style={[styles.headerBadge, { backgroundColor: colors.accent + '18' }]}>
                    <Ionicons name="help-circle" size={20} color={colors.accent} />
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Hero */}
                <View style={[styles.hero, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '25' }]}>
                    <Ionicons name="help-buoy" size={36} color={colors.accent} />
                    <Text style={[styles.heroTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        How can we help?
                    </Text>
                    <Text style={[styles.heroSub, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                        Browse FAQs below or reach out to our support team.
                    </Text>
                </View>

                {/* Search */}
                <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text, fontFamily: FontFamily.regular }]}
                        placeholder="Search FAQs..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <Pressable onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                    )}
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActions}>
                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => Linking.openURL('mailto:shibya2025@gmail.com?subject=Support Request')}
                        activeOpacity={0.75}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: '#2B6CB0' + '18' }]}>
                            <Ionicons name="mail" size={20} color="#2B6CB0" />
                        </View>
                        <Text style={[styles.quickLabel, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Email Support
                        </Text>
                        <Text style={[styles.quickSub, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            2 business days
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => Linking.openURL('mailto:shibya2025@gmail.com?subject=Bug Report')}
                        activeOpacity={0.75}
                    >
                        <View style={[styles.quickIcon, { backgroundColor: '#E53E3E' + '18' }]}>
                            <Ionicons name="bug" size={20} color="#E53E3E" />
                        </View>
                        <Text style={[styles.quickLabel, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Report a Bug
                        </Text>
                        <Text style={[styles.quickSub, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            Help us improve
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Section label */}
                <Text style={[styles.faqHeading, { color: colors.textSecondary, fontFamily: FontFamily.semiBold }]}>
                    FREQUENTLY ASKED QUESTIONS
                </Text>

                {/* FAQ Sections */}
                {filteredSections.map(s => (
                    <HelpSectionCard key={s.id} section={s} colors={colors} />
                ))}

                {filteredSections.length === 0 && (
                    <View style={styles.noResults}>
                        <Ionicons name="search-outline" size={36} color={colors.textMuted} />
                        <Text style={[styles.noResultsText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            No results found. Try a different keyword or contact support.
                        </Text>
                    </View>
                )}

                {/* Report Problem */}
                <View style={[styles.reportCard, { backgroundColor: '#E53E3E' + '08', borderColor: '#E53E3E' + '25' }]}>
                    <Ionicons name="warning" size={22} color="#E53E3E" />
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.reportTitle, { color: colors.text, fontFamily: FontFamily.semiBold }]}>
                            Report a Problem
                        </Text>
                        <Text style={[styles.reportBody, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            Encountered a serious issue, fraud, or policy violation?
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.reportBtn, { backgroundColor: '#E53E3E' }]}
                        onPress={() => Linking.openURL('mailto:shibya2025@gmail.com?subject=Problem Report')}
                    >
                        <Text style={[styles.reportBtnText, { fontFamily: FontFamily.bold }]}>Report</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
        borderBottomWidth: 1, gap: Spacing.md,
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
        alignItems: 'center', gap: Spacing.sm, borderWidth: 1,
    },
    heroTitle: { fontSize: FontSize.xl, textAlign: 'center' },
    heroSub: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg, borderWidth: 1,
    },
    searchInput: { flex: 1, fontSize: FontSize.sm, paddingVertical: 4 },
    quickActions: { flexDirection: 'row', gap: Spacing.md },
    quickBtn: {
        flex: 1, borderRadius: BorderRadius.lg, padding: Spacing.md,
        alignItems: 'center', gap: 6, borderWidth: 1,
    },
    quickIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    quickLabel: { fontSize: FontSize.sm, textAlign: 'center' },
    quickSub: { fontSize: FontSize.xs, textAlign: 'center' },
    faqHeading: {
        fontSize: FontSize.xs, letterSpacing: 1,
        textTransform: 'uppercase', marginTop: Spacing.sm, marginLeft: 4,
    },
    sectionCard: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md, gap: Spacing.md,
    },
    sectionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { flex: 1, fontSize: FontSize.md },
    faqCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    faqCountText: { fontSize: FontSize.xs, fontFamily: FontFamily.bold },
    faqList: { borderTopWidth: 1 },
    faqItem: { borderBottomWidth: 1, padding: Spacing.md },
    faqHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
    faqQ: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
    faqA: { fontSize: FontSize.sm, lineHeight: 22, marginTop: Spacing.sm },
    noResults: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
    noResultsText: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
    reportCard: {
        flexDirection: 'row', alignItems: 'center',
        gap: Spacing.md, padding: Spacing.md,
        borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.sm,
    },
    reportTitle: { fontSize: FontSize.md },
    reportBody: { fontSize: FontSize.xs, marginTop: 2 },
    reportBtn: {
        paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.md,
    },
    reportBtnText: { color: '#FFF', fontSize: FontSize.sm },
});
