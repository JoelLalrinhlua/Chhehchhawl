/**
 * phone-auth.tsx — Phone number + OTP verification screen.
 *
 * Two-step flow:
 *  1. Enter Indian phone number → sends OTP via a custom Supabase RPC.
 *  2. Enter the 6-digit OTP → verifies via another custom RPC.
 *
 * On success, the user’s session is established and they’re routed to the
 * profile-completion flow (or directly to tabs if the profile already exists).
 */

import { AnimatedInput } from '@/components/AnimatedInput';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

type Step = 'phone' | 'otp';

export default function PhoneAuthScreen() {
    const { signInWithPhone, verifyPhoneOtp } = useAuth();
    const { colors } = useTheme();

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buttonScale = useSharedValue(1);
    const buttonAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const handleSendOtp = async () => {
        if (!phone.trim()) {
            setError('Please enter your phone number');
            return;
        }

        // Basic phone validation — must start with + and have at least 10 digits
        const phoneRegex = /^\+\d{10,15}$/;
        if (!phoneRegex.test(phone.trim())) {
            setError('Enter phone with country code (e.g., +91XXXXXXXXXX)');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await signInWithPhone(phone.trim());
        setLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            setStep('otp');
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp.trim() || otp.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setLoading(true);
        setError(null);

        const result = await verifyPhoneOtp(phone.trim(), otp.trim());
        setLoading(false);

        if (result.error) {
            setError(result.error);
        }
        // Navigation happens automatically via auth state change in _layout.tsx
    };

    const styles = makeStyles(colors);

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                {/* Header */}
                <Animated.View entering={FadeInDown.duration(600)}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {step === 'phone' ? 'Phone Login' : 'Verify Code'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                        {step === 'phone'
                            ? 'Enter your phone number with country code'
                            : `We sent a 6-digit code to ${phone}`}
                    </Text>
                </Animated.View>

                {/* Error */}
                {error && (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={18} color="#FF4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                )}

                {/* Phone Step */}
                {step === 'phone' && (
                    <Animated.View entering={FadeInRight.duration(400)} style={styles.form}>
                        <AnimatedInput
                            placeholder="+91XXXXXXXXXX"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />

                        <Animated.View style={buttonAnimStyle}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                                onPress={handleSendOtp}
                                onPressIn={() => {
                                    buttonScale.value = withTiming(0.97, { duration: 80 });
                                }}
                                onPressOut={() => {
                                    buttonScale.value = withTiming(1, { duration: 80 });
                                }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitText}>Send Code</Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                )}

                {/* OTP Step */}
                {step === 'otp' && (
                    <Animated.View entering={FadeInRight.duration(400)} style={styles.form}>
                        <AnimatedInput
                            placeholder="000000"
                            value={otp}
                            onChangeText={setOtp}
                            keyboardType="number-pad"
                            maxLength={6}
                        />

                        <Animated.View style={buttonAnimStyle}>
                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                                onPress={handleVerifyOtp}
                                onPressIn={() => {
                                    buttonScale.value = withTiming(0.97, { duration: 80 });
                                }}
                                onPressOut={() => {
                                    buttonScale.value = withTiming(1, { duration: 80 });
                                }}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitText}>Verify</Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>

                        <TouchableOpacity
                            onPress={() => {
                                setStep('phone');
                                setOtp('');
                                setError(null);
                            }}
                            style={styles.resendButton}
                        >
                            <Text style={[styles.resendText, { color: colors.accent }]}>
                                Change number or resend code
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const makeStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        content: {
            flex: 1,
            paddingHorizontal: Spacing.xl,
            paddingTop: Platform.OS === 'ios' ? 80 : 60,
        },
        backButton: {
            width: 44,
            height: 44,
            justifyContent: 'center',
            marginBottom: Spacing.lg,
        },
        title: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
            marginBottom: Spacing.xs,
        },
        subtitle: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            marginBottom: Spacing.xl,
            lineHeight: 20,
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(255, 68, 68, 0.1)',
            padding: Spacing.sm,
            borderRadius: BorderRadius.md,
            marginBottom: Spacing.md,
        },
        errorText: {
            color: '#FF4444',
            fontFamily: FontFamily.medium,
            fontSize: FontSize.sm,
            flex: 1,
        },
        form: {
            gap: Spacing.md,
        },
        submitButton: {
            height: 52,
            borderRadius: BorderRadius.lg,
            justifyContent: 'center',
            alignItems: 'center',
        },
        submitText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        resendButton: {
            alignItems: 'center',
            paddingVertical: Spacing.md,
        },
        resendText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
    });
