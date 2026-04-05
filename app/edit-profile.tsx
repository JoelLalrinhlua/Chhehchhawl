/**
 * edit-profile.tsx — Edit profile screen.
 *
 * Allows the user to update:
 *  - Profile picture (via expo-image-picker with built-in quality compression)
 *  - Full name
 *  - Username (with live availability check)
 *  - Bio (max 150 characters)
 *
 * Avatar upload flow:
 *  1. Pick image from gallery (quality: 0.65 → JPEG compression at pick time)
 *  2. Read local file via expo-file-system as base64
 *  3. Upload to Supabase Storage `avatars` bucket 
 *  4. Save public URL to `profiles.avatar_url`
 *
 * NOTE: No expo-image-manipulator used — works in dev-client without a rebuild.
 */

import { AnimatedInput } from '@/components/AnimatedInput';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsernameCheck } from '@/hooks/use-profile-queries';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BIO       = 150;
// expo-image-picker quality: 0 = max compression, 1 = no compression.
// 0.65 produces ~100-250 KB JPEGs from typical phone photos.
const IMAGE_QUALITY = 0.65;

// Cooldown windows
const USERNAME_COOLDOWN_DAYS  = 7;   // 1 week
const FULLNAME_COOLDOWN_DAYS  = 30;  // 1 month

/**
 * Returns null if the field is NOT in cooldown (can be changed).
 * Returns a human-readable string describing when they can next change it if locked.
 */
function getCooldownMessage(lastChangedIso: string | null | undefined, cooldownDays: number): string | null {
    if (!lastChangedIso) return null;
    const last      = new Date(lastChangedIso);
    const unlockAt  = new Date(last.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
    const now       = new Date();
    if (now >= unlockAt) return null; // Cooldown over

    const diffMs    = unlockAt.getTime() - now.getTime();
    const diffDays  = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));

    if (diffDays > 1) return `You can change this again in ${diffDays} day${diffDays !== 1 ? 's' : ''}.`;
    if (diffHours > 1) return `You can change this again in ${diffHours} hour${diffHours !== 1 ? 's' : ''}.`;
    return 'You can change this again in less than an hour.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
    const router                          = useRouter();
    const { user, profile, updateProfile } = useAuth();
    const { colors }                      = useTheme();

    // ── State ───────────────────────────────────────────────────────────────
    const [fullName,    setFullName]    = useState(profile?.full_name  ?? '');
    const [username,    setUsername]    = useState(profile?.username   ?? '');
    const [bio,         setBio]         = useState(profile?.bio        ?? '');
    const [avatarUri,   setAvatarUri]   = useState<string | null>(profile?.avatar_url ?? null);

    const [debouncedUsername, setDebouncedUsername] = useState('');
    const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [avatarLoading, setAvatarLoading] = useState(false);
    const [saving,        setSaving]        = useState(false);
    const [error,         setError]         = useState<string | null>(null);

    // ── Cooldown guards ─────────────────────────────────────────────────────
    const usernameCooldown  = getCooldownMessage(profile?.username_updated_at,  USERNAME_COOLDOWN_DAYS);
    const fullNameCooldown  = getCooldownMessage(profile?.full_name_updated_at, FULLNAME_COOLDOWN_DAYS);
    const isUsernameLocked  = !!usernameCooldown;
    const isFullNameLocked  = !!fullNameCooldown;

    const handleLockedFullNamePress = () => {
        Alert.alert(
            '🔒 Full Name Locked',
            `Your full name can only be changed once every ${FULLNAME_COOLDOWN_DAYS} days.\n\n${fullNameCooldown}`,
            [{ text: 'OK' }]
        );
    };

    const handleLockedUsernamePress = () => {
        Alert.alert(
            '🔒 Username Locked',
            `Your username can only be changed once every ${USERNAME_COOLDOWN_DAYS} days.\n\n${usernameCooldown}`,
            [{ text: 'OK' }]
        );
    };


    const saveScale = useSharedValue(1);
    const saveAnimStyle = useAnimatedStyle(() => ({
        transform: [{ scale: saveScale.value }],
    }));

    // Username availability check (skip if unchanged)
    const isUsernameChanged = username !== (profile?.username ?? '');
    const {
        data: usernameAvailable,
        isFetching: usernameChecking,
    } = useUsernameCheck(
        isUsernameChanged && debouncedUsername.length >= 3 ? debouncedUsername : '',
        user?.id,
    );

    // Sync profile data on mount
    useEffect(() => {
        setFullName(profile?.full_name  ?? '');
        setUsername(profile?.username   ?? '');
        setBio(profile?.bio             ?? '');
        setAvatarUri(profile?.avatar_url ?? null);
    }, [profile]);

    // ── Username debounce ───────────────────────────────────────────────────
    const handleUsernameChange = (text: string) => {
        if (isUsernameLocked) return;
        const cleaned = text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        setUsername(cleaned);
        setError(null);
        if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
        if (cleaned.length >= 3) {
            usernameTimerRef.current = setTimeout(() => setDebouncedUsername(cleaned), 600);
        } else {
            setDebouncedUsername('');
        }
    };

    // ── Avatar pick & compress ──────────────────────────────────────────────
    const handlePickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile picture.');
            return;
        }

        // quality: IMAGE_QUALITY → OS-level JPEG compression at pick time.
        // base64: true → gets us the compressed data directly, no fetch() needed.
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: IMAGE_QUALITY,
            base64: true,
        });

        if (result.canceled || !result.assets[0]) return;

        setAvatarLoading(true);
        setError(null);

        try {
            const asset = result.assets[0];

            if (!asset.base64) {
                setError('Could not read image data. Please try again.');
                setAvatarLoading(false);
                return;
            }

            // Convert base64 string → Uint8Array for Supabase Storage
            const byteChars = atob(asset.base64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }

            const fileName = `${user!.id}_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, byteArray, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) {
                setError(`Upload failed: ${uploadError.message}`);
                setAvatarLoading(false);
                return;
            }

            const { data: urlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const publicUrl = urlData.publicUrl;
            setAvatarUri(publicUrl);

            // Immediately persist the new avatar URL
            await updateProfile({ avatar_url: publicUrl });
        } catch (err: any) {
            setError(err.message || 'Failed to upload image');
        }

        setAvatarLoading(false);
    };

    // ── Save ────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!isFullNameLocked && !fullName.trim()) { setError('Full name is required'); return; }
        if (!isUsernameLocked && (!username.trim() || username.trim().length < 3)) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (!isUsernameLocked && isUsernameChanged && usernameAvailable === false) {
            setError('That username is already taken');
            return;
        }
        if (!isUsernameLocked && isUsernameChanged && usernameChecking) {
            setError('Please wait — checking username availability');
            return;
        }

        setSaving(true);
        setError(null);
        saveScale.value = withTiming(0.96, { duration: 60 });

        // Build the update payload, only including fields that changed
        const payload: Record<string, any> = {
            bio: bio.trim() || null,
        };

        if (!isFullNameLocked) {
            payload.full_name          = fullName.trim();
            payload.full_name_updated_at = new Date().toISOString();
        }

        if (!isUsernameLocked) {
            payload.username            = username.trim().toLowerCase();
            payload.username_updated_at = new Date().toISOString();
        }

        const result = await updateProfile(payload);

        saveScale.value = withTiming(1, { duration: 60 });
        setSaving(false);

        if (result.error) {
            if (result.error.includes('duplicate') || result.error.includes('unique')) {
                setError('That username is already taken');
            } else {
                setError(result.error);
            }
        } else {
            // Navigate back to profile on success
            router.back();
        }
    };

    // ── Derived ─────────────────────────────────────────────────────────────
    const initials = (profile?.full_name || user?.email || 'U')
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const styles = makeStyles(colors);

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
                <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    style={styles.saveHeaderBtn}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <Text style={[styles.saveHeaderText, { color: colors.accent }]}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Avatar */}
                <Animated.View entering={FadeIn.duration(350)} style={styles.avatarSection}>
                    <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={handlePickAvatar}
                        disabled={avatarLoading}
                        activeOpacity={0.8}
                    >
                        {avatarLoading ? (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.card }]}>
                                <ActivityIndicator size="large" color={colors.accent} />
                            </View>
                        ) : avatarUri ? (
                            <Image
                                source={{ uri: avatarUri }}
                                style={styles.avatarImage}
                                contentFit="cover"
                                transition={300}
                            />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent + '25' }]}>
                                <Text style={[styles.initialsText, { color: colors.accent }]}>{initials}</Text>
                            </View>
                        )}

                        {/* Camera badge */}
                        <View style={[styles.cameraBadge, { backgroundColor: colors.accent }]}>
                            <Ionicons name="camera" size={16} color="#FFF" />
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
                        Tap to change photo · Images are compressed automatically
                    </Text>
                </Animated.View>

                {/* Error */}
                {error && (
                    <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBanner, { backgroundColor: '#F44336' + '15', borderColor: '#F44336' + '40' }]}>
                        <Ionicons name="alert-circle-outline" size={16} color="#F44336" />
                        <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
                    </Animated.View>
                )}

                {/* Full Name */}
                <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        Full Name <Text style={{ color: colors.accent }}>*</Text>
                    </Text>
                    <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                        Your legal name — kept private
                    </Text>
                    {isFullNameLocked ? (
                        <TouchableOpacity
                            onPress={handleLockedFullNamePress}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.readonlyField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.readonlyText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                                    {fullName || 'Not set'}
                                </Text>
                                <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <AnimatedInput
                            placeholder="Enter your full name"
                            value={fullName}
                            onChangeText={(t: string) => { setFullName(t); setError(null); }}
                            autoCapitalize="words"
                        />
                    )}
                </Animated.View>

                {/* Username */}
                <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        Username <Text style={{ color: colors.accent }}>*</Text>
                    </Text>
                    <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                        Your public display name visible to others
                    </Text>
                    {isUsernameLocked ? (
                        <TouchableOpacity
                            onPress={handleLockedUsernamePress}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.readonlyField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.readonlyText, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                                    {username || 'Not set'}
                                </Text>
                                <Ionicons name="lock-closed" size={15} color={colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <View>
                            <AnimatedInput
                                placeholder="Choose a unique username"
                                value={username}
                                onChangeText={handleUsernameChange}
                                autoCapitalize="none"
                            />
                            {isUsernameChanged && usernameChecking && (
                                <View style={styles.usernameStatus}>
                                    <ActivityIndicator size="small" color={colors.textMuted} />
                                    <Text style={[styles.usernameStatusText, { color: colors.textMuted }]}>Checking…</Text>
                                </View>
                            )}
                            {isUsernameChanged && !usernameChecking && usernameAvailable === true && username.length >= 3 && (
                                <Animated.View entering={FadeIn.duration(200)} style={styles.usernameStatus}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                    <Text style={[styles.usernameStatusText, { color: '#4CAF50' }]}>Available</Text>
                                </Animated.View>
                            )}
                            {isUsernameChanged && !usernameChecking && usernameAvailable === false && (
                                <Animated.View entering={FadeIn.duration(200)} style={styles.usernameStatus}>
                                    <Ionicons name="close-circle" size={16} color="#F44336" />
                                    <Text style={[styles.usernameStatusText, { color: '#F44336' }]}>Already taken</Text>
                                </Animated.View>
                            )}
                        </View>
                    )}
                </Animated.View>

                {/* Bio */}
                <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.fieldGroup}>
                    <View style={styles.labelRow}>
                        <View>
                            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Bio</Text>
                            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                                A short description about yourself
                            </Text>
                        </View>
                        <Text style={[styles.charCount, {
                            color: bio.length > MAX_BIO * 0.85
                                ? colors.statusOrange
                                : colors.textMuted,
                        }]}>
                            {bio.length}/{MAX_BIO}
                        </Text>
                    </View>
                    <AnimatedInput
                        placeholder="Tell others a bit about yourself…"
                        value={bio}
                        onChangeText={(t: string) => { setBio(t.slice(0, MAX_BIO)); }}
                        multiline
                        numberOfLines={4}
                    />
                </Animated.View>

                {/* Location (read-only) */}
                <Animated.View entering={FadeInDown.delay(250).duration(350)} style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Location</Text>
                    <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                        Set during profile setup — contact support to change
                    </Text>
                    <View style={[styles.readonlyField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                        <Text style={[styles.readonlyText, { color: profile?.location ? colors.textSecondary : colors.textMuted }]}>
                            {profile?.location || 'No location set'}
                        </Text>
                        <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                    </View>
                </Animated.View>

                {/* Save Button — outer for entering anim, inner for press scale */}
                <Animated.View entering={FadeInDown.delay(300).duration(350)} style={{ marginTop: Spacing.sm }}>
                    <Animated.View style={saveAnimStyle}>
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                            onPress={handleSave}
                            disabled={saving}
                            activeOpacity={0.85}
                            onPressIn={() => { saveScale.value = withTiming(0.97, { duration: 60 }); }}
                            onPressOut={() => { saveScale.value = withTiming(1, { duration: 60 }); }}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={20} color="#FFF" />
                                    <Text style={styles.saveBtnText}>Save Changes</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </Animated.View>
                </Animated.View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: any) =>
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
        saveHeaderBtn: {
            width: 60,
            alignItems: 'flex-end',
            justifyContent: 'center',
        },
        saveHeaderText: {
            fontSize: FontSize.md,
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
        // Avatar
        avatarSection: {
            alignItems: 'center',
            paddingVertical: Spacing.md,
            gap: Spacing.sm,
        },
        avatarWrapper: {
            position: 'relative',
        },
        avatarImage: {
            width: 100,
            height: 100,
            borderRadius: 50,
        },
        avatarPlaceholder: {
            width: 100,
            height: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
        },
        initialsText: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
        },
        cameraBadge: {
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarHint: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
        },
        // Errors
        errorBanner: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
        },
        successBanner: {
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
        // Fields
        fieldGroup: {
            gap: 4,
        },
        fieldLabel: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.semiBold,
            marginBottom: 2,
        },
        fieldHint: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            marginBottom: 6,
        },
        usernameStatus: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
        },
        usernameStatusText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
        },
        labelRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
        },
        charCount: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            marginTop: 2,
        },
        readonlyField: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1.5,
        },
        readonlyText: {
            flex: 1,
            fontSize: FontSize.md,
            fontFamily: FontFamily.regular,
        },
        // Save button
        saveBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
            height: 56,
            borderRadius: BorderRadius.lg,
        },
        saveBtnText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        // statusOrange (used in charCount color)
        statusOrange: {
            color: '#FF9800',
        },
    });
