/**
 * welcome.tsx — First-time welcome screen shown after profile completion.
 *
 * Displayed exactly once per user (tracked via AsyncStorage keyed by userId).
 * Features:
 *  • Animated ninja mascot entrance
 *  • App name + tagline
 *  • 3 feature highlight cards (Find Tasks, Earn Money, Stay Connected)
 *  • "Let's Go" CTA that marks the screen as seen and navigates to (tabs)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { getWelcomeSeenKey } from '@/lib/welcome-seen';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MASCOT = require('@/assets/images/mascot.png');

const FEATURES = [
    {
        icon: '🔍',
        title: 'Find Tasks Near You',
        desc: 'Browse local tasks posted by people in your area instantly.',
    },
    {
        icon: '💸',
        title: 'Earn on Your Terms',
        desc: 'Pick tasks that suit your skills and schedule. Get paid directly.',
    },
    {
        icon: '⚡',
        title: 'Real-Time Updates',
        desc: 'Chat, apply, and get notified as things happen — no delays.',
    },
];



export default function WelcomeScreen() {
    const router = useRouter();
    const { user } = useAuth();

    // ── Animations ──
    const mascotY    = useRef(new Animated.Value(-60)).current;
    const mascotOpacity = useRef(new Animated.Value(0)).current;
    const mascotScale = useRef(new Animated.Value(0.7)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const titleY     = useRef(new Animated.Value(24)).current;
    const cardsOpacity = useRef(new Animated.Value(0)).current;
    const cardsY     = useRef(new Animated.Value(32)).current;
    const ctaOpacity = useRef(new Animated.Value(0)).current;
    const ctaScale   = useRef(new Animated.Value(0.9)).current;

    // Glow pulse on mascot
    const glowScale  = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Staggered entrance sequence
        Animated.sequence([
            // 1. Mascot drops in + bounces
            Animated.parallel([
                Animated.spring(mascotY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
                Animated.spring(mascotScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
                Animated.timing(mascotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
            ]),
            // 2. Title fades up
            Animated.parallel([
                Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
                Animated.timing(titleY, { toValue: 0, duration: 350, useNativeDriver: true }),
            ]),
            // 3. Feature cards appear
            Animated.parallel([
                Animated.timing(cardsOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(cardsY, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]),
            // 4. CTA pops in
            Animated.parallel([
                Animated.spring(ctaOpacity, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
                Animated.spring(ctaScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
            ]),
        ]).start();

        // Continuous glow pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowScale, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
                Animated.timing(glowScale, { toValue: 1, duration: 1800, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const handleGetStarted = async () => {
        if (user?.id) {
            await AsyncStorage.setItem(getWelcomeSeenKey(user.id), 'true');
        }
        router.replace('/(tabs)');
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Background blobs */}
            <View style={[styles.blob, styles.blobTop]} />
            <View style={[styles.blob, styles.blobBottom]} />

            {/* Mascot area */}
            <View style={styles.mascotArea}>
                {/* Outer pulsing glow ring */}
                <Animated.View style={[styles.glowOuter, { transform: [{ scale: glowScale }] }]} />

                {/* White circular card that frames the image naturally */}
                <Animated.View
                    style={[
                        styles.mascotCard,
                        {
                            opacity: mascotOpacity,
                            transform: [
                                { translateY: mascotY },
                                { scale: mascotScale },
                            ],
                        },
                    ]}
                >
                    <Image
                        source={MASCOT}
                        style={styles.mascot}
                        resizeMode="contain"
                    />
                </Animated.View>
            </View>

            {/* Text block */}
            <Animated.View
                style={[
                    styles.textBlock,
                    { opacity: titleOpacity, transform: [{ translateY: titleY }] },
                ]}
            >
                <Text style={styles.welcomeLabel}>Welcome to</Text>
                <Text style={styles.appName}>Chhehchhawl</Text>
                <Text style={styles.tagline}>
                    Your neighbourhood task marketplace 🌸
                </Text>
            </Animated.View>

            {/* Feature cards */}
            <Animated.View
                style={[
                    styles.cards,
                    { opacity: cardsOpacity, transform: [{ translateY: cardsY }] },
                ]}
            >
                {FEATURES.map((f, i) => (
                    <View key={i} style={styles.card}>
                        <Text style={styles.cardIcon}>{f.icon}</Text>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>{f.title}</Text>
                            <Text style={styles.cardDesc}>{f.desc}</Text>
                        </View>
                    </View>
                ))}
            </Animated.View>

            {/* CTA */}
            <Animated.View
                style={[
                    styles.ctaWrap,
                    { opacity: ctaOpacity, transform: [{ scale: ctaScale }] },
                ]}
            >
                <Pressable
                    style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
                    onPress={handleGetStarted}
                >
                    <Text style={styles.ctaText}>Let's Go! 🚀</Text>
                </Pressable>
                <Text style={styles.ctaHint}>No credit card needed · Free to join</Text>
            </Animated.View>
        </SafeAreaView>
    );
}

const ACCENT = '#F5004F';
const BG = '#0E0E0E';
const SURFACE = '#181818';
const BORDER = '#2A2A2A';
const TEXT = '#FFFFFF';
const TEXT_MUTED = '#888888';
const TEXT_SECONDARY = '#AAAAAA';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        overflow: 'hidden',
    },

    // ── Background blobs ──
    blob: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.18,
    },
    blobTop: {
        width: SCREEN_W * 0.9,
        height: SCREEN_W * 0.9,
        backgroundColor: ACCENT,
        top: -SCREEN_W * 0.5,
        left: -SCREEN_W * 0.2,
    },
    blobBottom: {
        width: SCREEN_W * 0.7,
        height: SCREEN_W * 0.7,
        backgroundColor: '#8B00FF',
        bottom: -SCREEN_W * 0.4,
        right: -SCREEN_W * 0.2,
    },

    // ── Mascot ──
    mascotArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: Spacing.lg,
    },
    glowOuter: {
        position: 'absolute',
        width: 230,
        height: 230,
        borderRadius: 115,
        backgroundColor: 'rgba(245, 0, 79, 0.22)',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 40,
        elevation: 0,
    },
    mascotCard: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    mascot: {
        width: 185,
        height: 185,
    },

    // ── Text block ──
    textBlock: {
        alignItems: 'center',
        gap: 4,
    },
    welcomeLabel: {
        fontSize: FontSize.md,
        color: TEXT_SECONDARY,
        fontFamily: FontFamily.medium,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    appName: {
        fontSize: FontSize.xxxl,
        color: TEXT,
        fontFamily: FontFamily.bold,
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: FontSize.md,
        color: TEXT_MUTED,
        fontFamily: FontFamily.regular,
        textAlign: 'center',
        marginTop: 2,
    },

    // ── Feature cards ──
    cards: {
        width: '100%',
        gap: Spacing.sm,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SURFACE,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: BORDER,
        padding: Spacing.md,
        gap: Spacing.md,
    },
    cardIcon: {
        fontSize: 28,
        width: 40,
        textAlign: 'center',
    },
    cardText: {
        flex: 1,
        gap: 2,
    },
    cardTitle: {
        fontSize: FontSize.md,
        color: TEXT,
        fontFamily: FontFamily.semiBold,
    },
    cardDesc: {
        fontSize: FontSize.sm,
        color: TEXT_MUTED,
        fontFamily: FontFamily.regular,
        lineHeight: 18,
    },

    // ── CTA ──
    ctaWrap: {
        width: '100%',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    cta: {
        width: '100%',
        backgroundColor: ACCENT,
        borderRadius: BorderRadius.full,
        paddingVertical: Spacing.lg,
        alignItems: 'center',
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
        elevation: 10,
    },
    ctaText: {
        fontSize: FontSize.lg,
        color: '#FFFFFF',
        fontFamily: FontFamily.bold,
        letterSpacing: 0.3,
    },
    ctaHint: {
        fontSize: FontSize.xs,
        color: TEXT_MUTED,
        fontFamily: FontFamily.regular,
    },
});
