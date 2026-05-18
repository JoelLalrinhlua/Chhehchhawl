/**
 * (tabs)/profile.tsx — User profile screen.
 *
 * Displays the current user's avatar, name, username, email, phone, date
 * of birth, location (state & district), and joined date. Includes a
 * dark/light theme toggle and a sign-out button with animated press feedback.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { CustomAlert } from '@/components/CustomAlert';
import { NotificationSheet } from '@/components/NotificationSheet';
import { useToast } from '@/contexts/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    Linking,
    Modal,
} from 'react-native';
import { useState } from 'react';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    ZoomIn,
    ZoomOut
} from 'react-native-reanimated';

export default function ProfileScreen() {
    const { user, profile, signOut } = useAuth();
    const { isDark, toggleTheme, colors } = useTheme();
    const { showToast } = useToast();
    const router = useRouter();

    const logoutScale = useSharedValue(1);
    const logoutAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: logoutScale.value }],
    }));

    const [logoutAlertVisible, setLogoutAlertVisible] = useState(false);
    const [supportModalVisible, setSupportModalVisible] = useState(false);
    const [notifVisible, setNotifVisible] = useState(false);

    const handleLogout = () => {
        setLogoutAlertVisible(true);
    };

    const handleSupportDevs = () => {
        Linking.openURL('upi://pay?pa=joelkizyking@oksbi&pn=Chhehchhawl%20Developer&cu=INR').catch(() => {
            showToast('No UPI payment app found on this device.', 'warning');
        });
    };

    const confirmLogout = async () => {
        setLogoutAlertVisible(false);
        logoutScale.value = withTiming(0.95, { duration: 80 }, () => {
            logoutScale.value = withTiming(1, { duration: 80 });
        });
        await signOut();
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
                {/* Avatar — shows photo if available, else initials */}
                <TouchableOpacity
                    style={styles.avatarWrapper}
                    onPress={() => router.push('/edit-profile')}
                    activeOpacity={0.85}
                >
                    {profile?.avatar_url ? (
                        <Image
                            source={{ uri: profile.avatar_url }}
                            style={[styles.avatar, styles.avatarImage]}
                            contentFit="cover"
                            transition={300}
                        />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.accent + '30' }]}>
                            <Text style={[styles.avatarText, { color: colors.accent }]}>{initials}</Text>
                        </View>
                    )}
                    <View style={[styles.editBadge, { backgroundColor: colors.accent }]}>
                        <Ionicons name="camera" size={12} color="#FFF" />
                    </View>
                </TouchableOpacity>

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
                {profile?.bio ? (
                    <Text style={[styles.bioText, { color: colors.textSecondary }]}>
                        {profile.bio}
                    </Text>
                ) : null}
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
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => router.push('/edit-profile')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Edit Profile</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                        style={styles.settingRow}
                        activeOpacity={0.7}
                        onPress={() => setNotifVisible(true)}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Notifications</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Support */}
            <View>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support</Text>
                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => router.push('/help-center' as any)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="help-circle-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Help Center</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => router.push('/privacy' as any)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Privacy Policy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => router.push('/suggestions')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="bulb-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Suggestions</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => router.push('/terms-of-service')}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Terms of Service</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={() => setSupportModalVisible(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingLeft}>
                            <Ionicons name="heart-outline" size={22} color={colors.textSecondary} />
                            <Text style={[styles.settingText, { color: colors.text }]}>Support the Devs</Text>
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

            <CustomAlert
                visible={logoutAlertVisible}
                title="Sign Out"
                message="Are you sure you want to sign out?"
                onDismiss={() => setLogoutAlertVisible(false)}
                buttons={[
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: confirmLogout }
                ]}
            />

            {/* Support Devs Modal */}
            <Modal
                visible={supportModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSupportModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }}>
                    <Animated.View 
                        entering={ZoomIn.duration(220)}
                        exiting={ZoomOut.duration(200)}
                        style={{ width: '100%', maxWidth: 400, backgroundColor: colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
                            <Text style={{ fontSize: FontSize.xl, fontFamily: FontFamily.bold, color: colors.text }}>Support the Devs</Text>
                            <TouchableOpacity onPress={() => setSupportModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={24} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: FontSize.md, fontFamily: FontFamily.regular, marginBottom: Spacing.xl, lineHeight: 22 }}>
                            If building Chhehchhawl has brought value to you and you want to help keep the servers running and fuel future updates, please consider leaving a tip! Every little bit helps. 🚀
                        </Text>
                        <TouchableOpacity
                            style={{
                                backgroundColor: colors.accent,
                                borderRadius: BorderRadius.md,
                                paddingVertical: Spacing.md,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                            }}
                            onPress={handleSupportDevs}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="heart" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#FFF', fontFamily: FontFamily.bold, fontSize: FontSize.md }}>
                                Support via UPI
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
            {/* Notification Center */}
            <NotificationSheet
                visible={notifVisible}
                onClose={() => setNotifVisible(false)}
            />
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
        avatarWrapper: {
            position: 'relative',
            marginBottom: Spacing.md,
        },
        avatar: {
            width: 88,
            height: 88,
            borderRadius: 44,
            justifyContent: 'center',
            alignItems: 'center',
        },
        avatarImage: {
            width: 88,
            height: 88,
            borderRadius: 44,
        },
        editBadge: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
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
        bioText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            marginTop: 8,
            paddingHorizontal: Spacing.lg,
            lineHeight: 20,
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
