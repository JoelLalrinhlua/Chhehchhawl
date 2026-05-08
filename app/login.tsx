/**
 * login.tsx — Authentication screen.
 *
 * Supports two sign-in methods:
 *  1. Email + password (with registration toggle)
 *  2. Google OAuth (opens in-app browser)
 *
 * Includes real-time email validation and password-strength feedback.
 */

import { AnimatedInput } from '@/components/AnimatedInput';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { checkPasswordStrength, isValidEmail } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
    const { signIn, signUp, signInWithGoogle } = useAuth();
    const { colors } = useTheme();
    const { showToast } = useToast();

    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const signedUpEmail = useRef('');

    // Client-side brute-force protection: lock out after 5 failed sign-in attempts
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_SECONDS = 30;

    const buttonScale = useSharedValue(1);
    const buttonAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const handleEmailAuth = async () => {
        // --- Client-side lockout check ---
        if (!isSignUp && lockoutUntil !== null) {
            const secondsLeft = Math.ceil((lockoutUntil - Date.now()) / 1000);
            if (secondsLeft > 0) {
                setError(`Too many failed attempts. Try again in ${secondsLeft}s.`);
                return;
            } else {
                // Lockout expired — reset counters
                setLockoutUntil(null);
                setFailedAttempts(0);
            }
        }

        // --- Validation ---
        if (!email.trim() || !password.trim()) {
            setError('Please fill in all fields');
            return;
        }

        if (!isValidEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (isSignUp) {
            const strength = checkPasswordStrength(password);
            if (!strength.valid) {
                setError(strength.message);
                return;
            }
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        } else if (password.length < 8) {
            // Must match the 8-char minimum enforced on sign-up
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        setError(null);

        const result = isSignUp
            ? await signUp(email.trim(), password)
            : await signIn(email.trim(), password);

        setLoading(false);

        if (result.error) {
            setError(result.error);
            if (!isSignUp) {
                // Track failed sign-in attempts for rate-limiting
                const newCount = failedAttempts + 1;
                setFailedAttempts(newCount);
                if (newCount >= MAX_ATTEMPTS) {
                    setLockoutUntil(Date.now() + LOCKOUT_SECONDS * 1000);
                    setError(`Too many failed attempts. Locked out for ${LOCKOUT_SECONDS} seconds.`);
                }
            }
        } else if (isSignUp) {
            signedUpEmail.current = email.trim();
            setShowVerifyModal(true);
        } else {
            // Successful sign-in — reset attempt counter
            setFailedAttempts(0);
            setLockoutUntil(null);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        setError(null);
        const result = await signInWithGoogle();
        setGoogleLoading(false);
        if (result.error && result.error !== 'OAuth cancelled') {
            setError(result.error);
        }
    };

    const styles = makeStyles(colors);

    const handleGoToSignIn = () => {
        setShowVerifyModal(false);
        setIsSignUp(false);
        setPassword('');
        setConfirmPassword('');
        setError(null);
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Logo */}
                <Animated.View entering={FadeIn.duration(800)} style={styles.logoSection}>
                    <Image
                        source={require('@/assets/images/LOGO Chhehchhawl.png')}
                        style={styles.logo}
                        contentFit="contain"
                    />
                    <Image
                        source={require('@/assets/images/Chhehchhawl Title.png')}
                        style={styles.titleImage}
                        contentFit="contain"
                    />
                    <Text style={[styles.tagline, { color: colors.textMuted }]}>
                        Feel less stressed and more mindful{'\n'}with local service
                    </Text>
                </Animated.View>

                {/* Auth Form */}
                <Animated.View entering={FadeInDown.duration(800).delay(400)} style={styles.formSection}>
                    {error && (
                        <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={18} color="#FF4444" />
                            <Text style={styles.errorText}>{error}</Text>
                        </Animated.View>
                    )}

                    <AnimatedInput
                        placeholder="Email address"
                        value={email}
                        onChangeText={(t: string) => { setEmail(t); setError(null); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    {/* Password field with show/hide toggle */}
                    <View style={styles.passwordWrapper}>
                        <AnimatedInput
                            placeholder="Password"
                            value={password}
                            onChangeText={(t: string) => { setPassword(t); setError(null); }}
                            secureTextEntry={!showPassword}
                            containerStyle={{ flex: 1 }}
                        />
                        <Pressable
                            style={styles.eyeBtn}
                            onPress={() => setShowPassword(v => !v)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={22}
                                color={colors.textMuted}
                            />
                        </Pressable>
                    </View>
                    {isSignUp && (
                        <>
                            {/* Confirm password with show/hide toggle */}
                            <View style={styles.passwordWrapper}>
                                <AnimatedInput
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChangeText={(t: string) => { setConfirmPassword(t); setError(null); }}
                                    secureTextEntry={!showConfirmPassword}
                                    containerStyle={{ flex: 1 }}
                                />
                                <Pressable
                                    style={styles.eyeBtn}
                                    onPress={() => setShowConfirmPassword(v => !v)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons
                                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </Pressable>
                            </View>
                            {/* Password strength hints */}
                            {password.length > 0 && (
                                <Animated.View entering={FadeIn.duration(200)} style={styles.strengthContainer}>
                                    {[
                                        { ok: password.length >= 8, label: '8+ characters' },
                                        { ok: /\d/.test(password), label: 'Contains a number' },
                                    ].map((r) => (
                                        <View key={r.label} style={styles.strengthRow}>
                                            <Ionicons
                                                name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                                                size={14}
                                                color={r.ok ? '#4CAF50' : colors.textMuted}
                                            />
                                            <Text style={[styles.strengthLabel, { color: r.ok ? '#4CAF50' : colors.textMuted }]}>
                                                {r.label}
                                            </Text>
                                        </View>
                                    ))}
                                </Animated.View>
                            )}
                        </>
                    )}

                    {/* Submit Button */}
                    <Animated.View style={buttonAnimStyle}>
                        <TouchableOpacity
                            style={[styles.submitButton, { backgroundColor: colors.accent }]}
                            onPress={handleEmailAuth}
                            onPressIn={() => {
                                buttonScale.value = withTiming(0.97, { duration: 80 });
                            }}
                            onPressOut={() => {
                                buttonScale.value = withTiming(1, { duration: 80 });
                            }}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitText}>
                                    {isSignUp ? 'Create Account' : 'Sign In'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerText, { color: colors.textMuted }]}>or</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Google Sign-In */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        onPress={handleGoogleSignIn}
                        disabled={googleLoading}
                        activeOpacity={0.8}
                    >
                        {googleLoading ? (
                            <ActivityIndicator color="#1F1F1F" size="small" />
                        ) : (
                            <>
                                <View style={styles.googleIconContainer}>
                                    <Image
                                        source={require('@/assets/images/google-icon-logo-svgrepo-com.svg')}
                                        style={styles.googleLogo}
                                        contentFit="contain"
                                    />
                                </View>
                                <Text style={styles.googleText}>
                                    Sign in with Google
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>


                    {/* Toggle Sign Up / Sign In */}
                    <TouchableOpacity
                        onPress={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                        }}
                        style={styles.toggleButton}
                    >
                        <Text style={[styles.toggleText, { color: colors.textMuted }]}>
                            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                            <Text style={{ color: colors.accent, fontFamily: FontFamily.semiBold }}>
                                {isSignUp ? 'Sign In' : 'Sign Up'}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>

            {/* ── Email Verification Modal ── */}
            <Modal
                visible={showVerifyModal}
                transparent
                animationType="fade"
                statusBarTranslucent
            >
                <View style={styles.modalOverlay}>
                    <Animated.View entering={FadeInDown.duration(400)} style={[styles.modalCard, { backgroundColor: colors.card }]}>
                        {/* Icon */}
                        <View style={styles.modalIconWrapper}>
                            <View style={[styles.modalIconBg, { backgroundColor: colors.accent + '22' }]}>
                                <Ionicons name="mail-outline" size={40} color={colors.accent} />
                            </View>
                        </View>

                        <Text style={[styles.modalTitle, { color: colors.text }]}>Check your inbox!</Text>

                        <Text style={[styles.modalBody, { color: colors.textMuted }]}>
                            We've sent a confirmation link to{' '}
                            <Text style={[styles.modalEmail, { color: colors.accent }]}>
                                {signedUpEmail.current}
                            </Text>
                            {'. Please open it to verify your account before signing in.'}
                        </Text>

                        {/* Divider */}
                        <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />

                        <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                            Didn't receive it? Check your spam folder or wait a few minutes.
                        </Text>

                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                            onPress={handleGoToSignIn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-back-outline" size={18} color="#FFF" />
                            <Text style={styles.modalBtnText}>Go to Sign In</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: Spacing.xl,
        },
        logoSection: {
            alignItems: 'center',
            marginBottom: Spacing.xl,
        },
        logo: {
            width: 120,
            height: 120,
            marginBottom: Spacing.md,
        },
        titleImage: {
            width: SCREEN_WIDTH * 0.65,
            height: 44,
            marginBottom: Spacing.md,
        },
        tagline: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            lineHeight: 20,
        },
        formSection: {
            gap: Spacing.md,
            paddingHorizontal: 16, // Squeezes inputs to be more in the middle
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: Spacing.sm,
            borderRadius: BorderRadius.md,
        },
        errorText: {
            color: '#FF4444',
            fontFamily: FontFamily.medium,
            fontSize: FontSize.sm,
            flex: 1,
        },
        submitButton: {
            height: 52,
            borderRadius: BorderRadius.lg,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: Spacing.xs,
        },
        submitText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        divider: {
            flexDirection: 'row',
            alignItems: 'center',
            marginVertical: Spacing.sm,
        },
        dividerLine: {
            flex: 1,
            height: 1,
        },
        dividerText: {
            marginHorizontal: Spacing.md,
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
        },
        googleButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 52,
            borderRadius: 100, // Pill shape
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            paddingHorizontal: 16,
            marginBottom: Spacing.sm,
            borderColor: '#747775', // Standard Google outline color
        },
        googleIconContainer: {
            position: 'absolute',
            left: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        googleLogo: {
            width: 24,
            height: 24,
        },
        googleText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.medium, // Google uses Roboto Medium
            color: '#1F1F1F',
        },
        phoneButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 46,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            gap: 10,
        },
        phoneText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
        toggleButton: {
            alignItems: 'center',
            paddingVertical: Spacing.sm,
        },
        toggleText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
        },
        strengthContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 4,
        },
        strengthRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        strengthLabel: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
        },
        passwordWrapper: {
            position: 'relative',
            flexDirection: 'row',
            alignItems: 'center',
        },
        eyeBtn: {
            position: 'absolute',
            right: 14,
            top: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
        },
        // ── Verification Modal ──
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 28,
        },
        modalCard: {
            width: '100%',
            borderRadius: 24,
            padding: 28,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
        },
        modalIconWrapper: {
            marginBottom: 20,
        },
        modalIconBg: {
            width: 80,
            height: 80,
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
        },
        modalTitle: {
            fontSize: FontSize.xl,
            fontFamily: FontFamily.bold,
            marginBottom: 12,
            textAlign: 'center',
        },
        modalBody: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 20,
        },
        modalEmail: {
            fontFamily: FontFamily.semiBold,
        },
        modalDivider: {
            width: '100%',
            height: 1,
            marginBottom: 16,
        },
        modalHint: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 18,
        },
        modalBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: '100%',
            height: 50,
            borderRadius: BorderRadius.lg,
        },
        modalBtnText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
    });
