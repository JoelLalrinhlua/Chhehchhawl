/**
 * (tabs)/profile.tsx — User profile screen.
 *
 * Displays the current user’s avatar, name, username, email, phone, date
 * of birth, location (state & district), and joined date. Includes a
 * dark/light theme toggle and a sign-out button with animated press feedback.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

export default function ProfileScreen() {
    const { user, profile, signOut } = useAuth();
    const { isDark, toggleTheme, colors } = useTheme();

    const logoutScale = useSharedValue(1);
    const logoutAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoutScale.value }],
    }));

    const handleLogout = () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        logoutScale.value = withTiming(0.95, { duration: 80 }, () => {
                            logoutScale.value = withTiming(1, { duration: 80 });
                        });
                        await signOut();
                    },
                },
            ]
        );
    };

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || user?.phone || '';
    const initials = displayName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const styles = makeStyles(colors);

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: colors.background }]}
            contentContainerStyle={styles.scrollContent}
        >
            {/* Profile Header */}
            <View style={styles.profileHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.accent + '30' }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
                </View>
                <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
                <Text style={[styles.email, { color: colors.textMuted }]}>{displayEmail}</Text>
                {profile?.username && (
                    <Text style={[styles.username, { color: colors.textSecondary }]}>
                        @{profile.username}
                    </Text>
                )}
                {profile?.location && (
                    <View style={styles.locationRow}>
                        <Ionicons name="location" size={14} color={colors.textMuted} />
                        <Text style={[styles.locationText, { color: colors.textMuted }]}>
                            {profile.location}
                        </Text>
                    </View>
                )}
            </View>

            {/* Appearance */}
            <View>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons
                                name={isDark ? 'moon' : 'sunny'}
                                size={22}
                                color={colors.accent}
                            />
                            <Text style={[styles.settingText, { color: colors.text }]}>
                                Dark Mode
                            </Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: colors.border, true: colors.accent + '80' }}
                            thumbColor={isDark ? colors.accent : '#f4f3f4'}
                        />
                    </View>
                </View>
            </View>

            {/* Account */}
            <View>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Edit Profile</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Notifications</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="shield-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Privacy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Support */}
            <View>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Help Center</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Terms of Service</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Logout */}
            <View>
              <Animated.View style={logoutAnimStyle}>
                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: '#FF4444' }]}
                    onPress={handleLogout}
                    onPressIn={() => {
                        logoutScale.value = withTiming(0.96, { duration: 80 });
                    }}
                    onPressOut={() => {
                        logoutScale.value = withTiming(1, { duration: 80 });
                    }}
                >
                    <Ionicons name="log-out-outline" size={22} color="#FF4444" />
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
        </ScrollView>
    );
}

const makeStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: Spacing.lg,
            paddingTop: Platform.OS === 'ios' ? 70 : 50,
            paddingBottom: Spacing.huge,
        },
        profileHeader: {
            alignItems: 'center',
            marginBottom: Spacing.xl,
        },
        avatar: {
            width: 80,
            height: 80,
            borderRadius: 40,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: Spacing.md,
        },
        avatarText: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
        },
        name: {
            fontSize: FontSize.xl,
            fontFamily: FontFamily.bold,
            marginBottom: 4,
        },
        email: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
        },
        username: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
            marginTop: 2,
        },
        locationRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
        },
        locationText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
        },
        sectionTitle: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.semiBold,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: Spacing.sm,
            marginLeft: 4,
        },
        card: {
            borderRadius: BorderRadius.lg,
            overflow: 'hidden',
            marginBottom: Spacing.lg,
        },
        settingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
        },
        settingLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.md,
        },
        settingText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.medium,
        },
        rowDivider: {
            height: 1,
            marginLeft: Spacing.md + 22 + Spacing.md,
        },
        logoutButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            height: 52,
            borderRadius: BorderRadius.lg,
            borderWidth: 1.5,
            marginTop: Spacing.md,
        },
        logoutText: {
            color: '#FF4444',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
    });
