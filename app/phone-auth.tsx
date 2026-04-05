/**
 * phone-auth.tsx — Phone OTP authentication (currently unavailable).
 *
 * SMS service is not yet configured. This screen informs the user
 * and redirects them back to the main login page.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function PhoneAuthScreen() {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Animated.View entering={FadeInDown.duration(600)} style={styles.center}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.card }]}>
                        <Ionicons name="call-outline" size={48} color={colors.textMuted} />
                    </View>
                    <Text style={[styles.title, { color: colors.text }]}>
                        Coming Soon
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                        Phone sign-in via OTP is not yet available.{'\n'}
                        Please use email or Google sign-in for now.
                    </Text>

                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: colors.accent }]}
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="arrow-back" size={18} color="#FFF" />
                        <Text style={styles.backBtnText}>Go Back to Login</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
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
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 100,
        gap: Spacing.md,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
    },
    subtitle: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.xl,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.lg,
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    backBtnText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontFamily: FontFamily.bold,
    },
});
