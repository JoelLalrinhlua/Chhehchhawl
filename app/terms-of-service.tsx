/**
 * terms-of-service.tsx — Legal Terms of Service screen.
 *
 * A professionally written, scrollable legal document covering:
 *  - Acceptance of terms
 *  - Platform overview and eligibility
 *  - User accounts and responsibilities
 *  - Task posting and acceptance
 *  - Payments and fees
 *  - Prohibited conduct
 *  - Disclaimers and limitation of liability
 *  - Intellectual property
 *  - Dispute resolution
 *  - Modifications and termination
 *  - Contact information
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ number, title, colors }: { number: string; title: string; colors: any }) {
    return (
        <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionNumber, { backgroundColor: colors.accent + '18' }]}>
                <Text style={[styles.sectionNumberText, { color: colors.accent, fontFamily: FontFamily.bold }]}>
                    {number}
                </Text>
            </View>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                {title}
            </Text>
        </View>
    );
}

function Para({ children, colors }: { children: React.ReactNode; colors: any }) {
    return (
        <Text style={[styles.para, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
            {children}
        </Text>
    );
}

function Bullet({ children, colors }: { children: React.ReactNode; colors: any }) {
    return (
        <View style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.bulletText, { color: colors.textSecondary, fontFamily: FontFamily.regular }]}>
                {children}
            </Text>
        </View>
    );
}

function Divider({ colors }: { colors: any }) {
    return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TermsOfServiceScreen() {
    const router    = useRouter();
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                    Terms of Service
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <Animated.View entering={FadeIn.duration(400)}>
                    <View style={[styles.heroBanner, { backgroundColor: colors.accent + '12', borderColor: colors.accent + '35' }]}>
                        <Ionicons name="shield-checkmark" size={28} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.heroTitle, { color: colors.accent, fontFamily: FontFamily.bold }]}>
                                Chhehchhawl Terms of Service
                            </Text>
                            <Text style={[styles.heroSubtitle, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                Please read these terms carefully before using the platform.
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* ── Section 1 ── */}
                <Animated.View entering={FadeInDown.delay(60).duration(350)}>
                    <SectionHeader number="1" title="Acceptance of Terms" colors={colors} />
                    <Para colors={colors}>
                        By downloading, installing, or using Chhehchhawl (the "Platform," "App," or "Service"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, you must not access or use the Platform.
                    </Para>
                    <Para colors={colors}>
                        These Terms constitute a legally binding agreement between you ("User") and Chhehchhawl ("we," "us," or "our"). Use of the Platform is conditioned upon your acceptance of and compliance with all of these Terms.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 2 ── */}
                <Animated.View entering={FadeInDown.delay(80).duration(350)}>
                    <SectionHeader number="2" title="Platform Overview & Eligibility" colors={colors} />
                    <Para colors={colors}>
                        Chhehchhawl is a peer-to-peer task marketplace that connects individuals seeking help with everyday tasks ("Task Posters") with people willing to complete those tasks in exchange for compensation ("Taskers"). We do not directly provide any task-related services; we serve solely as a platform to facilitate these connections.
                    </Para>
                    <Para colors={colors}>
                        To use Chhehchhawl, you must:
                    </Para>
                    <Bullet colors={colors}>Be at least 18 years of age, or the age of majority in your jurisdiction.</Bullet>
                    <Bullet colors={colors}>Have the legal capacity to enter into binding contracts.</Bullet>
                    <Bullet colors={colors}>Not be barred from using the Platform under applicable laws.</Bullet>
                    <Bullet colors={colors}>Provide accurate, truthful, and complete registration information.</Bullet>
                    <Para colors={colors}>
                        We reserve the right to refuse access to any person or entity and to terminate accounts at our discretion.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 3 ── */}
                <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                    <SectionHeader number="3" title="User Accounts & Security" colors={colors} />
                    <Para colors={colors}>
                        You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You agree to notify us immediately at shibya2025@gmail.com if you suspect any unauthorized use of your account.
                    </Para>
                    <Para colors={colors}>
                        You may not share your account, impersonate another person, or create multiple accounts for the purpose of circumventing our policies. Each account is personal and non-transferable.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 4 ── */}
                <Animated.View entering={FadeInDown.delay(120).duration(350)}>
                    <SectionHeader number="4" title="Task Posting & Acceptance" colors={colors} />
                    <Para colors={colors}>
                        Task Posters are solely responsible for accurately describing tasks, including any physical, technical, or logistical requirements. Chhehchhawl does not verify the accuracy of task descriptions.
                    </Para>
                    <Para colors={colors}>
                        Taskers agree to perform tasks diligently and in accordance with the agreed-upon terms. Any agreement, arrangement, or outcome arising between Task Posters and Taskers is strictly between those parties. Chhehchhawl is not a party to those agreements and bears no liability for their fulfilment or breach.
                    </Para>
                    <Para colors={colors}>
                        We reserve the right to remove any task listing that, in our determination, violates these Terms or is contrary to applicable laws or community standards.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 5 ── */}
                <Animated.View entering={FadeInDown.delay(140).duration(350)}>
                    <SectionHeader number="5" title="Payments, Fees & Disputes" colors={colors} />
                    <Para colors={colors}>
                        Chhehchhawl may charge a platform service fee on transactions. All fees will be clearly disclosed before a transaction is confirmed. All monetary values on the Platform are expressed in Indian Rupees (₹).
                    </Para>
                    <Para colors={colors}>
                        All payment disputes between Task Posters and Taskers are to be resolved between those parties. While we may offer mediation tools, we do not guarantee refunds or enforce payment obligations on behalf of either party.
                    </Para>
                    <Para colors={colors}>
                        We are not a payment processor or financial institution. Any third-party payment processing is subject to the terms and policies of those third parties.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 6 ── */}
                <Animated.View entering={FadeInDown.delay(160).duration(350)}>
                    <SectionHeader number="6" title="Prohibited Conduct" colors={colors} />
                    <Para colors={colors}>
                        You agree not to engage in any of the following conduct on or through the Platform:
                    </Para>
                    <Bullet colors={colors}>Post, transmit, or solicit illegal, fraudulent, or harmful content or tasks.</Bullet>
                    <Bullet colors={colors}>Harass, threaten, defame, or discriminate against any user.</Bullet>
                    <Bullet colors={colors}>Circumvent the Platform by conducting transactions off-platform to evade fees.</Bullet>
                    <Bullet colors={colors}>Use automated tools (bots, scrapers) to access the Platform without written permission.</Bullet>
                    <Bullet colors={colors}>Interfere with, compromise, or disrupt the Platform's systems or security.</Bullet>
                    <Bullet colors={colors}>Submit false reviews, manipulate ratings, or otherwise misrepresent any party.</Bullet>
                    <Bullet colors={colors}>Use the Platform for any purpose that violates applicable local, national, or international law.</Bullet>
                    <Para colors={colors}>
                        Violation of this section may result in immediate account suspension or termination, and may be reported to the appropriate authorities.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 7 ── */}
                <Animated.View entering={FadeInDown.delay(180).duration(350)}>
                    <SectionHeader number="7" title="Disclaimers of Warranties" colors={colors} />
                    <Para colors={colors}>
                        THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
                    </Para>
                    <Para colors={colors}>
                        We do not warrant that (a) the Platform will be uninterrupted, error-free, or free of harmful components; (b) any content or information on the Platform is accurate, complete, or reliable; (c) the results of using the Platform will meet your expectations.
                    </Para>
                    <Para colors={colors}>
                        We do not screen, vet, or verify the identity, credentials, background, or conduct of any user. You interact with other users entirely at your own risk.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 8 ── */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)}>
                    <SectionHeader number="8" title="Limitation of Liability" colors={colors} />
                    <Para colors={colors}>
                        TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, CHHEHCHHAWL, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND LICENSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH:
                    </Para>
                    <Bullet colors={colors}>Your use of or inability to use the Platform.</Bullet>
                    <Bullet colors={colors}>Any physical, financial, or reputational harm arising from interactions with other users.</Bullet>
                    <Bullet colors={colors}>Unauthorised access to or alterations of your transmissions or data.</Bullet>
                    <Bullet colors={colors}>Any task performed or failed to be performed by a Tasker.</Bullet>
                    <Bullet colors={colors}>Any content posted by users on the Platform.</Bullet>
                    <Para colors={colors}>
                        In no event shall our aggregate liability exceed the amount paid by you (if any) to us in the three (3) months preceding the event giving rise to the claim.
                    </Para>
                    <Para colors={colors}>
                        Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability. In such cases, our liability is limited to the greatest extent permitted by law.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 9 ── */}
                <Animated.View entering={FadeInDown.delay(220).duration(350)}>
                    <SectionHeader number="9" title="Indemnification" colors={colors} />
                    <Para colors={colors}>
                        You agree to indemnify, defend, and hold harmless Chhehchhawl and its affiliates, officers, directors, employees, and agents from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including legal fees) arising from:
                    </Para>
                    <Bullet colors={colors}>Your use of the Platform in violation of these Terms.</Bullet>
                    <Bullet colors={colors}>Your violation of any third-party rights, including intellectual property or privacy rights.</Bullet>
                    <Bullet colors={colors}>Any claim that content you submitted or a task you posted caused harm to a third party.</Bullet>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 10 ── */}
                <Animated.View entering={FadeInDown.delay(240).duration(350)}>
                    <SectionHeader number="10" title="Intellectual Property" colors={colors} />
                    <Para colors={colors}>
                        All content, trademarks, logos, and intellectual property on the Platform (excluding user-generated content) are owned by or licensed to Chhehchhawl and are protected by applicable intellectual property laws.
                    </Para>
                    <Para colors={colors}>
                        You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the Platform for its intended purposes. You must not copy, reproduce, distribute, modify, or create derivative works based on our content without express written permission.
                    </Para>
                    <Para colors={colors}>
                        By submitting content (including task descriptions, messages, or profile information) to the Platform, you grant us a worldwide, royalty-free, perpetual, irrevocable licence to use, display, and reproduce such content solely for operating and improving the Platform.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 11 ── */}
                <Animated.View entering={FadeInDown.delay(260).duration(350)}>
                    <SectionHeader number="11" title="Governing Law & Disputes" colors={colors} />
                    <Para colors={colors}>
                        These Terms are governed by and construed in accordance with the laws of India, without regard to conflict of law principles. Any disputes arising under or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Mizoram, India.
                    </Para>
                    <Para colors={colors}>
                        Before initiating any formal dispute, you agree to contact us at shibya2025@gmail.com to attempt good-faith resolution. We will endeavour to respond within 14 business days.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 12 ── */}
                <Animated.View entering={FadeInDown.delay(280).duration(350)}>
                    <SectionHeader number="12" title="Modifications & Termination" colors={colors} />
                    <Para colors={colors}>
                        We reserve the right to modify these Terms at any time. When changes are made, we will notify users through the Platform or by other means. Your continued use of the Platform following the effective date of the revised Terms constitutes your acceptance of the updated Terms.
                    </Para>
                    <Para colors={colors}>
                        We may suspend or terminate your account at any time, with or without cause, and with or without notice, if we determine that you have violated these Terms or applicable law. Upon termination, all rights granted to you under these Terms will immediately cease.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Section 13 ── */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)}>
                    <SectionHeader number="13" title="Severability & Entire Agreement" colors={colors} />
                    <Para colors={colors}>
                        If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.
                    </Para>
                    <Para colors={colors}>
                        These Terms, together with our Privacy Policy, constitute the entire agreement between you and Chhehchhawl with respect to your use of the Platform and supersede all prior agreements, representations, and warranties.
                    </Para>
                </Animated.View>

                <Divider colors={colors} />

                {/* ── Contact ── */}
                <Animated.View entering={FadeInDown.delay(320).duration(350)}>
                    <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.contactHeader}>
                            <Ionicons name="mail" size={20} color={colors.accent} />
                            <Text style={[styles.contactTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Contact Us
                            </Text>
                        </View>
                        <Para colors={colors}>
                            If you have any questions or concerns regarding these Terms of Service, please reach out to us at:
                        </Para>
                        <Text style={[styles.contactEmail, { color: colors.accent, fontFamily: FontFamily.semiBold }]}>
                            shibya2025@gmail.com
                        </Text>
                        <Para colors={colors}>
                            We will make every effort to address your inquiry promptly and fairly.
                        </Para>
                    </View>
                </Animated.View>

                {/* Footer note */}
                <Animated.View entering={FadeInDown.delay(340).duration(350)}>
                    <Text style={[styles.footerNote, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        By using Chhehchhawl, you confirm that you have read and agreed to these Terms of Service.
                    </Text>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.huge * 2,
        gap: Spacing.lg,
    },
    heroBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.md,
    },
    heroTitle: {
        fontSize: FontSize.md,
        marginBottom: 4,
    },
    heroSubtitle: {
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
        marginTop: Spacing.sm,
    },
    sectionNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionNumberText: {
        fontSize: FontSize.sm,
    },
    sectionTitle: {
        fontSize: FontSize.md,
        flex: 1,
    },
    para: {
        fontSize: FontSize.sm,
        lineHeight: 22,
        marginBottom: Spacing.sm,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        marginBottom: Spacing.xs + 2,
        paddingLeft: Spacing.sm,
    },
    bulletDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 8,
        flexShrink: 0,
    },
    bulletText: {
        fontSize: FontSize.sm,
        lineHeight: 22,
        flex: 1,
    },
    divider: {
        height: 1,
        marginVertical: Spacing.sm,
    },
    contactCard: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    contactHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    contactTitle: {
        fontSize: FontSize.md,
    },
    contactEmail: {
        fontSize: FontSize.md,
        paddingVertical: Spacing.xs,
    },
    footerNote: {
        textAlign: 'center',
        fontSize: FontSize.xs,
        lineHeight: 18,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
    },
});
