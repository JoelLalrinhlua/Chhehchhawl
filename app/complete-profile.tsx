/**
 * complete-profile.tsx — Multi-step new-user profile setup.
 *
 * Three steps:
 *  1. **Personal info** — full name, username (live availability check), DOB, gender.
 *  2. **Phone verification** — enter phone → OTP (via custom RPCs).
 *  3. **Location** — auto-detect via `expo-location`, then select state & district.
 *
 * On completion, the profile is saved to Supabase and the user proceeds to
 * the main tab navigator. A sign-out option is available at every step.
 */

import { AnimatedInput } from '@/components/AnimatedInput';
import { getDistrictsForState, getStateNames } from '@/constants/indian-locations';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsernameCheck } from '@/hooks/use-profile-queries';
import { isValidDateOfBirth, normalizePhone } from '@/utils/validation';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    SlideInRight,
    SlideOutLeft,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOTAL_STEPS = 3;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
export default function CompleteProfileScreen() {
    const { user, updateProfile, sendPhoneVerification, verifyPhoneCode, signOut } = useAuth();
    const { colors } = useTheme();

    const [currentStep, setCurrentStep] = useState(1);
    const [error, setError] = useState<string | null>(null);

    // ── Cancel / Sign Out handler ──
    const handleCancelSetup = () => {
        Alert.alert(
            'Cancel Setup',
            'This will sign you out. You can sign in again later to complete your profile.',
            [
                { text: 'Continue Setup', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => { await signOut(); },
                },
            ],
        );
    };

    // ── Step 1: Basic Info ──
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [debouncedUsername, setDebouncedUsername] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced username validation via TanStack Query (cached, no duplicate calls)
    const {
        data: usernameAvailable,
        isFetching: usernameChecking,
    } = useUsernameCheck(debouncedUsername, user?.id);

    // ── Step 2: Location ──
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [pinLocation, setPinLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [locationLoading, setLocationLoading] = useState(true);
    const [statePickerVisible, setStatePickerVisible] = useState(false);
    const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
    const [locationDetectedText, setLocationDetectedText] = useState('');

    // ── Step 3: Phone OTP ──
    const [phone, setPhone] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState<string[]>(new Array(OTP_LENGTH).fill(''));
    const [otpLoading, setOtpLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [finalLoading, setFinalLoading] = useState(false);
    const otpInputRefs = useRef<(TextInput | null)[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Countdown timer ──
    useEffect(() => {
        if (resendTimer > 0) {
            timerRef.current = setInterval(() => {
                setResendTimer((prev) => {
                    if (prev <= 1) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [resendTimer]);

    // ── Username duplicate check (debounced via TanStack Query) ──
    const handleUsernameChange = (text: string) => {
        const cleaned = text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        setUsername(cleaned);
        setError(null);
        // Debounce: update the debounced value after 600ms
        if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
        if (cleaned.length >= 3) {
            usernameTimerRef.current = setTimeout(() => setDebouncedUsername(cleaned), 600);
        } else {
            setDebouncedUsername('');
        }
    };

    // ── Location init (Step 2) ──
    const detectLocation = useCallback(async () => {
        setLocationLoading(true);
        setError(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Required',
                    'Location permission is needed to detect your area. Please select your state and district manually.',
                );
                setLocationLoading(false);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            setPinLocation(coords);
            try {
                const [result] = await Location.reverseGeocodeAsync(coords);
                if (result) {
                    // Build display text from reverse geocode
                    const parts = [result.name, result.district, result.city, result.subregion, result.region].filter(Boolean);
                    setLocationDetectedText(parts.slice(0, 3).join(', '));

                    const states = getStateNames();
                    const detectedState = [result.region, result.subregion]
                        .filter(Boolean)
                        .find((r) => states.includes(r!));
                    if (detectedState) {
                        setSelectedState(detectedState);
                        const districts = getDistrictsForState(detectedState);
                        const detectedDistrict = [result.city, result.district, result.subregion]
                            .filter(Boolean)
                            .find((d) => districts.includes(d!));
                        if (detectedDistrict) setSelectedDistrict(detectedDistrict);
                    }
                }
            } catch { /* ignore reverse geocode errors */ }
        } catch {
            Alert.alert('Location Error', 'Could not get your location. Please select your state and district manually.');
        }
        setLocationLoading(false);
    }, []);

    useEffect(() => {
        if (currentStep === 2 && !userLocation) {
            detectLocation();
        }
    }, [currentStep, userLocation, detectLocation]);

    // ── Step validation ──
    const validateStep1 = (): boolean => {
        if (!fullName.trim()) { setError('Full name is required'); return false; }
        if (fullName.trim().length < 2) { setError('Full name must be at least 2 characters'); return false; }
        if (!username.trim()) { setError('Username is required'); return false; }
        if (username.trim().length < 3) { setError('Username must be at least 3 characters'); return false; }
        if (usernameAvailable === false) { setError('This username is already taken'); return false; }
        if (!dateOfBirth) { setError('Date of birth is required'); return false; }
        const isoDate = dateOfBirth.toISOString().split('T')[0];
        if (!isValidDateOfBirth(isoDate)) { setError('You must be at least 13 years old'); return false; }
        return true;
    };

    const validateStep2 = (): boolean => {
        if (!pinLocation) { setError('Please pin your home location on the map'); return false; }
        if (!selectedState) { setError('Please select your state'); return false; }
        if (!selectedDistrict) { setError('Please select your district'); return false; }
        return true;
    };

    const handleNext = () => {
        setError(null);
        if (currentStep === 1 && !validateStep1()) return;
        if (currentStep === 2 && !validateStep2()) return;
        setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
    };

    const handleBack = () => {
        setError(null);
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // ── Phone OTP ──
    const rawDigits = phone.replace(/\D/g, '');
    const isPhoneValid = rawDigits.length === 10 && /^[6-9]/.test(rawDigits);

    const handleSendOtp = async () => {
        if (!isPhoneValid) { setError('Enter a valid 10-digit Indian mobile number'); return; }
        setOtpLoading(true);
        setError(null);
        const normalized = normalizePhone(rawDigits);
        const result = await sendPhoneVerification(normalized);
        setOtpLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            setOtpSent(true);
            setResendTimer(RESEND_COOLDOWN);
            setTimeout(() => otpInputRefs.current[0]?.focus(), 300);
            // DEV ONLY: Show OTP in alert (remove before production)
            if (__DEV__ && result.otpPreview) {
                Alert.alert('Dev OTP', `Your verification code: ${result.otpPreview}`);
            }
        }
    };

    const handleOtpChange = (text: string, index: number) => {
        const digit = text.replace(/\D/g, '').slice(-1);
        const newCode = [...otpCode];
        newCode[index] = digit;
        setOtpCode(newCode);
        setError(null);
        if (digit && index < OTP_LENGTH - 1) {
            otpInputRefs.current[index + 1]?.focus();
        }
        const fullCode = newCode.join('');
        if (fullCode.length === OTP_LENGTH) handleVerifyOtp(fullCode);
    };

    const handleOtpKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otpCode[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
            const newCode = [...otpCode];
            newCode[index - 1] = '';
            setOtpCode(newCode);
        }
    };

    const handleVerifyOtp = async (code?: string) => {
        const finalCode = code || otpCode.join('');
        if (finalCode.length !== OTP_LENGTH) { setError('Please enter the full 6-digit code'); return; }
        setVerifyLoading(true);
        setError(null);
        const normalized = normalizePhone(rawDigits);
        const result = await verifyPhoneCode(normalized, finalCode);
        setVerifyLoading(false);
        if (result.error) {
            setError(result.error);
            setOtpCode(new Array(OTP_LENGTH).fill(''));
            otpInputRefs.current[0]?.focus();
        } else {
            setPhoneVerified(true);
        }
    };

    // ── Final Submit ──
    const handleFinishProfile = async () => {
        if (!phoneVerified) { setError('Please verify your phone number'); return; }
        setFinalLoading(true);
        setError(null);

        const isoDate = dateOfBirth!.toISOString().split('T')[0];
        const result = await updateProfile({
            full_name: fullName.trim(),
            username: username.trim().toLowerCase(),
            date_of_birth: isoDate,
            phone: normalizePhone(rawDigits),
            home_latitude: pinLocation!.latitude,
            home_longitude: pinLocation!.longitude,
            state: selectedState,
            district: selectedDistrict,
            location: `${selectedDistrict}, ${selectedState}`,
            profile_completed: true,
        });

        setFinalLoading(false);
        if (result.error) {
            if (result.error.includes('duplicate') || result.error.includes('unique')) {
                setError('This username is already taken');
            } else {
                setError(result.error);
            }
        }
    };

    // ── DOB display ──
    const formatDOB = (d: Date) =>
        d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 13);
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 120);

    const styles = makeStyles(colors);

    // ═══════════════════════════════
    // Picker Modal (State / District)
    // ═══════════════════════════════
    const renderPickerModal = (
        visible: boolean,
        onClose: () => void,
        title: string,
        items: string[],
        selected: string,
        onSelect: (item: string) => void,
    ) => (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
                <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.modalItem,
                                    { borderBottomColor: colors.border },
                                    selected === item && { backgroundColor: colors.accentLight },
                                ]}
                                onPress={() => { onSelect(item); onClose(); }}
                            >
                                <Text style={[
                                    styles.modalItemText,
                                    { color: selected === item ? colors.accent : colors.text },
                                ]}>
                                    {item}
                                </Text>
                                {selected === item && (
                                    <Ionicons name="checkmark" size={20} color={colors.accent} />
                                )}
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );

    // ═══════════════════════════════
    // Progress Bar
    // ═══════════════════════════════
    const renderProgressBar = () => {
        const stepLabels = ['Basic Info', 'Location', 'Verify Phone'];
        return (
            <View style={styles.progressContainer}>
                <Text style={[styles.stepIndicator, { color: colors.textMuted }]}>
                    Step {currentStep} of {TOTAL_STEPS}
                </Text>
                <View style={styles.progressBarRow}>
                    {[1, 2, 3].map((step) => (
                        <View key={step} style={styles.progressSegment}>
                            <View
                                style={[
                                    styles.progressDot,
                                    {
                                        backgroundColor: step <= currentStep ? colors.accent : colors.border,
                                        borderColor: step === currentStep ? colors.accent : 'transparent',
                                    },
                                ]}
                            >
                                {step < currentStep ? (
                                    <Ionicons name="checkmark" size={12} color="#FFF" />
                                ) : (
                                    <Text style={[styles.progressDotText, {
                                        color: step <= currentStep ? '#FFF' : colors.textMuted,
                                    }]}>{step}</Text>
                                )}
                            </View>
                            <Text style={[styles.progressLabel, {
                                color: step <= currentStep ? colors.text : colors.textMuted,
                                fontFamily: step === currentStep ? FontFamily.semiBold : FontFamily.regular,
                            }]}>{stepLabels[step - 1]}</Text>
                            {step < 3 && (
                                <View style={[styles.progressLine, {
                                    backgroundColor: step < currentStep ? colors.accent : colors.border,
                                }]} />
                            )}
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    // ═══════════════════════════════
    // Step 1: Basic Information
    // ═══════════════════════════════
    const renderStep1 = () => (
        <Animated.View key="step1" entering={SlideInRight.duration(350)} exiting={SlideOutLeft.duration(250)} style={styles.stepContent}>
            <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Basic Informations</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
                    Let's start with the essentials
                </Text>
            </View>

            {/* Full Name */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Full Name <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                    Your legal name — kept private, not shown publicly
                </Text>
                <AnimatedInput
                    placeholder="Enter your full name"
                    value={fullName}
                    onChangeText={(t: string) => { setFullName(t); setError(null); }}
                    autoCapitalize="words"
                />
            </View>

            {/* Username */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Username <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                    Your public display name visible to others
                </Text>
                <View>
                    <AnimatedInput
                        placeholder="Choose a unique username"
                        value={username}
                        onChangeText={handleUsernameChange}
                        autoCapitalize="none"
                    />
                    {usernameChecking && (
                        <View style={styles.usernameStatus}>
                            <ActivityIndicator size="small" color={colors.textMuted} />
                        </View>
                    )}
                    {!usernameChecking && usernameAvailable === true && username.length >= 3 && (
                        <Animated.View entering={FadeIn.duration(200)} style={styles.usernameStatus}>
                            <Ionicons name="checkmark-circle" size={18} color={colors.statusGreen} />
                            <Text style={[styles.usernameStatusText, { color: colors.statusGreen }]}>Available</Text>
                        </Animated.View>
                    )}
                    {!usernameChecking && usernameAvailable === false && (
                        <Animated.View entering={FadeIn.duration(200)} style={styles.usernameStatus}>
                            <Ionicons name="close-circle" size={18} color={colors.statusRed} />
                            <Text style={[styles.usernameStatusText, { color: colors.statusRed }]}>Taken</Text>
                        </Animated.View>
                    )}
                </View>
            </View>

            {/* Date of Birth */}
            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Date of Birth <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="calendar-outline" size={20} color={dateOfBirth ? colors.accent : colors.textMuted} />
                    <Text style={[styles.dateText, {
                        color: dateOfBirth ? colors.text : colors.textMuted,
                        fontFamily: dateOfBirth ? FontFamily.medium : FontFamily.regular,
                    }]}>
                        {dateOfBirth ? formatDOB(dateOfBirth) : 'Select your date of birth'}
                    </Text>
                </TouchableOpacity>
            </View>

            {showDatePicker && (
                Platform.OS === 'ios' ? (
                    <Modal transparent animationType="slide">
                        <View style={[styles.datePickerOverlay, { backgroundColor: colors.overlay }]}>
                            <View style={[styles.datePickerSheet, { backgroundColor: colors.surface }]}>
                                <View style={styles.datePickerHeader}>
                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                        <Text style={[styles.datePickerAction, { color: colors.textMuted }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <Text style={[styles.datePickerTitle, { color: colors.text }]}>Date of Birth</Text>
                                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                        <Text style={[styles.datePickerAction, { color: colors.accent }]}>Done</Text>
                                    </TouchableOpacity>
                                </View>
                                <DateTimePicker
                                    value={dateOfBirth || maxDate}
                                    mode="date"
                                    display="spinner"
                                    maximumDate={maxDate}
                                    minimumDate={minDate}
                                    onChange={(_, selected) => {
                                        if (selected) setDateOfBirth(selected);
                                    }}
                                    textColor={colors.text}
                                    style={{ height: 200 }}
                                />
                            </View>
                        </View>
                    </Modal>
                ) : (
                    <DateTimePicker
                        value={dateOfBirth || maxDate}
                        mode="date"
                        display="calendar"
                        maximumDate={maxDate}
                        minimumDate={minDate}
                        onChange={(_, selected) => {
                            setShowDatePicker(false);
                            if (selected) { setDateOfBirth(selected); setError(null); }
                        }}
                    />
                )
            )}
        </Animated.View>
    );

    // ═══════════════════════════════
    // Step 2: Location Setup
    // ═══════════════════════════════
    const renderStep2 = () => (
        <Animated.View key="step2" entering={SlideInRight.duration(350)} exiting={SlideOutLeft.duration(250)} style={styles.stepContent}>
            <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Home Location</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
                    Select your location — this stays private
                </Text>
            </View>

            {/* Location Detection Card */}
            <View style={[styles.locationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {locationLoading ? (
                    <View style={styles.locationCardLoading}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={[styles.locationCardLoadingText, { color: colors.textMuted }]}>
                            Detecting your location...
                        </Text>
                    </View>
                ) : userLocation ? (
                    <View style={styles.locationCardContent}>
                        <View style={[styles.locationIconCircle, { backgroundColor: colors.accent + '15' }]}>
                            <Ionicons name="location" size={28} color={colors.accent} />
                        </View>
                        <Text style={[styles.locationCardTitle, { color: colors.text }]}>
                            Location Detected
                        </Text>
                        {locationDetectedText ? (
                            <Text style={[styles.locationCardAddress, { color: colors.textSecondary }]}>
                                {locationDetectedText}
                            </Text>
                        ) : null}
                        <View style={[styles.coordsRow, { backgroundColor: colors.inputBackground }]}>
                            <Ionicons name="navigate-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.coordsText, { color: colors.textMuted }]}>
                                {userLocation.latitude.toFixed(5)}, {userLocation.longitude.toFixed(5)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.redetectButton, { borderColor: colors.accent }]}
                            onPress={detectLocation}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh" size={16} color={colors.accent} />
                            <Text style={[styles.redetectText, { color: colors.accent }]}>Re-detect Location</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.locationCardContent}>
                        <View style={[styles.locationIconCircle, { backgroundColor: colors.textMuted + '15' }]}>
                            <Ionicons name="location-outline" size={28} color={colors.textMuted} />
                        </View>
                        <Text style={[styles.locationCardTitle, { color: colors.text }]}>
                            No Location Detected
                        </Text>
                        <Text style={[styles.locationCardAddress, { color: colors.textMuted }]}>
                            Tap below to detect, or select your state and district manually
                        </Text>
                        <TouchableOpacity
                            style={[styles.detectButton, { backgroundColor: colors.accent }]}
                            onPress={detectLocation}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="locate" size={18} color="#FFF" />
                            <Text style={styles.detectButtonText}>Detect My Location</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={[styles.locationDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.locationManualHint, { color: colors.textMuted }]}>
                Confirm or correct your state and district below
            </Text>

            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    State <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <TouchableOpacity
                    style={[styles.dropdown, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                    onPress={() => setStatePickerVisible(true)}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.dropdownText, {
                        color: selectedState ? colors.text : colors.textMuted,
                    }]}>
                        {selectedState || 'Select your state'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    District <Text style={{ color: colors.accent }}>*</Text>
                </Text>
                <TouchableOpacity
                    style={[
                        styles.dropdown,
                        {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                            opacity: selectedState ? 1 : 0.5,
                        },
                    ]}
                    onPress={() => selectedState && setDistrictPickerVisible(true)}
                    activeOpacity={0.7}
                    disabled={!selectedState}
                >
                    <Text style={[styles.dropdownText, {
                        color: selectedDistrict ? colors.text : colors.textMuted,
                    }]}>
                        {selectedDistrict || (selectedState ? 'Select your district' : 'Select state first')}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            {renderPickerModal(
                statePickerVisible,
                () => setStatePickerVisible(false),
                'Select State',
                getStateNames(),
                selectedState,
                (s) => {
                    setSelectedState(s);
                    setSelectedDistrict('');
                    setError(null);
                },
            )}
            {renderPickerModal(
                districtPickerVisible,
                () => setDistrictPickerVisible(false),
                'Select District',
                getDistrictsForState(selectedState),
                selectedDistrict,
                (d) => { setSelectedDistrict(d); setError(null); },
            )}
        </Animated.View>
    );

    // ═══════════════════════════════
    // Step 3: Phone Verification
    // ═══════════════════════════════
    const renderStep3 = () => (
        <Animated.View key="step3" entering={SlideInRight.duration(350)} exiting={SlideOutLeft.duration(250)} style={styles.stepContent}>
            <View style={styles.stepHeader}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>Verify Phone Number</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
                    We'll send a 6-digit code to verify your number
                </Text>
            </View>

            {phoneVerified ? (
                <Animated.View entering={FadeIn.duration(400)} style={styles.verifiedContainer}>
                    <View style={[styles.verifiedCircle, { backgroundColor: colors.statusGreen + '20' }]}>
                        <Ionicons name="checkmark-circle" size={64} color={colors.statusGreen} />
                    </View>
                    <Text style={[styles.verifiedTitle, { color: colors.text }]}>Phone Verified!</Text>
                    <Text style={[styles.verifiedNumber, { color: colors.textSecondary }]}>
                        +91 {rawDigits}
                    </Text>
                    <Text style={[styles.verifiedHint, { color: colors.textMuted }]}>
                        Tap "Finish Setup" below to complete your profile
                    </Text>
                </Animated.View>
            ) : (
                <>
                    <View style={styles.field}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>
                            Mobile Number <Text style={{ color: colors.accent }}>*</Text>
                        </Text>
                        <View style={styles.phoneInputRow}>
                            <View style={[styles.countryCode, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Text style={[styles.countryCodeText, { color: colors.text }]}>+91</Text>
                            </View>
                            <View style={styles.phoneInputWrapper}>
                                <AnimatedInput
                                    placeholder="Enter 10 digit number"
                                    value={phone}
                                    onChangeText={(t: string) => {
                                        const digits = t.replace(/\D/g, '').slice(0, 10);
                                        setPhone(digits);
                                        setError(null);
                                        if (otpSent) {
                                            setOtpSent(false);
                                            setOtpCode(new Array(OTP_LENGTH).fill(''));
                                            setResendTimer(0);
                                        }
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={10}
                                    editable={!otpSent}
                                />
                            </View>
                        </View>
                        {rawDigits.length > 0 && rawDigits.length < 10 && (
                            <Text style={[styles.phoneCountHint, { color: colors.statusOrange }]}>
                                {10 - rawDigits.length} more digit{10 - rawDigits.length !== 1 ? 's' : ''} needed
                            </Text>
                        )}
                        {rawDigits.length === 10 && !(/^[6-9]/.test(rawDigits)) && (
                            <Text style={[styles.phoneCountHint, { color: colors.statusRed }]}>
                                Must start with 6, 7, 8, or 9
                            </Text>
                        )}
                    </View>

                    {!otpSent && (
                        <TouchableOpacity
                            style={[
                                styles.sendOtpBtn,
                                { backgroundColor: isPhoneValid ? colors.accent : colors.card },
                            ]}
                            onPress={handleSendOtp}
                            disabled={otpLoading || !isPhoneValid}
                            activeOpacity={0.8}
                        >
                            {otpLoading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="send" size={18} color={isPhoneValid ? '#FFF' : colors.textMuted} />
                                    <Text style={[styles.sendOtpBtnText, {
                                        color: isPhoneValid ? '#FFF' : colors.textMuted,
                                    }]}>Send OTP</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}

                    {otpSent && (
                        <Animated.View entering={FadeIn.duration(400)} style={styles.otpSection}>
                            <Text style={[styles.otpLabel, { color: colors.textSecondary }]}>
                                Enter the 6-digit code sent to{' '}
                                <Text style={{ fontFamily: FontFamily.semiBold, color: colors.text }}>
                                    +91 {rawDigits}
                                </Text>
                            </Text>
                            <View style={styles.otpRow}>
                                {otpCode.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { otpInputRefs.current[index] = ref; }}
                                        style={[
                                            styles.otpBox,
                                            {
                                                backgroundColor: colors.inputBackground,
                                                borderColor: digit ? colors.accent : colors.border,
                                                color: colors.text,
                                            },
                                        ]}
                                        value={digit}
                                        onChangeText={(t) => handleOtpChange(t, index)}
                                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        textContentType="oneTimeCode"
                                        autoComplete="sms-otp"
                                        selectTextOnFocus
                                    />
                                ))}
                            </View>
                            {verifyLoading && (
                                <ActivityIndicator color={colors.accent} size="small" style={{ marginTop: Spacing.sm }} />
                            )}
                            <View style={styles.resendRow}>
                                <Text style={[styles.resendText, { color: colors.textMuted }]}>
                                    Didn't receive the code?
                                </Text>
                                <TouchableOpacity
                                    onPress={handleSendOtp}
                                    disabled={resendTimer > 0}
                                >
                                    <Text style={[styles.resendAction, {
                                        color: resendTimer > 0 ? colors.textMuted : colors.accent,
                                    }]}>
                                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </>
            )}
        </Animated.View>
    );

    // ═══════════════════════════════
    // Main Render
    // ═══════════════════════════════
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
                {renderProgressBar()}

                {error && (
                    <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
                        <Ionicons name="alert-circle" size={18} color="#FF4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </Animated.View>
                )}

                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                {currentStep > 1 ? (
                    <TouchableOpacity style={[styles.backButton, { borderColor: colors.border }]} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={20} color={colors.text} />
                        <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: '#FF4444' }]}
                        onPress={handleCancelSetup}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={18} color="#FF4444" />
                        <Text style={[styles.cancelButtonText, { color: '#FF4444' }]}>Cancel</Text>
                    </TouchableOpacity>
                )}

                {currentStep < TOTAL_STEPS ? (
                    <TouchableOpacity
                        style={[styles.nextButton, { backgroundColor: colors.accent }]}
                        onPress={handleNext}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.nextButtonText}>Next</Text>
                        <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.nextButton,
                            { backgroundColor: phoneVerified ? colors.accent : colors.card },
                        ]}
                        onPress={handleFinishProfile}
                        disabled={!phoneVerified || finalLoading}
                        activeOpacity={0.8}
                    >
                        {finalLoading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color={phoneVerified ? '#FFF' : colors.textMuted}
                                />
                                <Text style={[styles.nextButtonText, {
                                    color: phoneVerified ? '#FFF' : colors.textMuted,
                                }]}>Finish Setup</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

// ═══════════════════════════════
// Styles
// ═══════════════════════════════
const makeStyles = (colors: any) =>
    StyleSheet.create({
        container: { flex: 1 },
        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: Spacing.xl,
            paddingTop: Platform.OS === 'ios' ? 70 : 50,
            paddingBottom: 100,
        },

        // ── Progress ──
        progressContainer: {
            marginBottom: Spacing.xl,
        },
        stepIndicator: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
            textAlign: 'center',
            marginBottom: Spacing.md,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        progressBarRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
        },
        progressSegment: {
            alignItems: 'center',
            flex: 1,
        },
        progressDot: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            marginBottom: Spacing.xs,
        },
        progressDotText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.bold,
        },
        progressLabel: {
            fontSize: 10,
            textAlign: 'center',
        },
        progressLine: {
            position: 'absolute',
            top: 14,
            left: '60%',
            right: '-40%',
            height: 2,
            zIndex: -1,
        },

        // ── Step Content ──
        stepContent: {
            gap: Spacing.lg,
        },
        stepHeader: {
            marginBottom: Spacing.sm,
        },
        stepTitle: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
            marginBottom: Spacing.xs,
        },
        stepSubtitle: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            lineHeight: 20,
        },

        // ── Fields ──
        field: { gap: Spacing.xs },
        label: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
            marginLeft: 4,
        },
        hint: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
            marginLeft: 4,
            marginBottom: 2,
        },

        // ── Username Status ──
        usernameStatus: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            position: 'absolute',
            right: 12,
            top: 14,
        },
        usernameStatusText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
        },

        // ── Date Picker ──
        dateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            height: 48,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            gap: Spacing.sm,
        },
        dateText: {
            fontSize: FontSize.md,
            flex: 1,
        },
        datePickerOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        datePickerSheet: {
            borderTopLeftRadius: BorderRadius.xxl,
            borderTopRightRadius: BorderRadius.xxl,
            paddingBottom: 40,
        },
        datePickerHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.lg,
        },
        datePickerTitle: {
            fontSize: FontSize.lg,
            fontFamily: FontFamily.bold,
        },
        datePickerAction: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.semiBold,
        },

        // ── Location Card ──
        locationCard: {
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            overflow: 'hidden',
        },
        locationCardLoading: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: Spacing.xxl,
            gap: Spacing.md,
        },
        locationCardLoadingText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.medium,
        },
        locationCardContent: {
            alignItems: 'center',
            paddingVertical: Spacing.xl,
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
        },
        locationIconCircle: {
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.xs,
        },
        locationCardTitle: {
            fontSize: FontSize.lg,
            fontFamily: FontFamily.bold,
        },
        locationCardAddress: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            lineHeight: 20,
        },
        coordsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.xs,
            borderRadius: BorderRadius.sm,
            marginTop: Spacing.xs,
        },
        coordsText: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.regular,
        },
        redetectButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            marginTop: Spacing.sm,
        },
        redetectText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.semiBold,
        },
        detectButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.md,
            marginTop: Spacing.sm,
        },
        detectButtonText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        locationDivider: {
            height: 1,
            marginVertical: Spacing.md,
        },
        locationManualHint: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
            marginBottom: Spacing.sm,
        },

        // ── Dropdown ──
        dropdown: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 48,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
        },
        dropdownText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.regular,
            flex: 1,
        },

        // ── Picker Modal ──
        modalOverlay: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        modalSheet: {
            maxHeight: SCREEN_HEIGHT * 0.6,
            borderTopLeftRadius: BorderRadius.xxl,
            borderTopRightRadius: BorderRadius.xxl,
            paddingBottom: 40,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.lg,
        },
        modalTitle: {
            fontSize: FontSize.lg,
            fontFamily: FontFamily.bold,
        },
        modalItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.lg,
            borderBottomWidth: StyleSheet.hairlineWidth,
        },
        modalItemText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.regular,
        },

        // ── Phone ──
        phoneInputRow: {
            flexDirection: 'row',
            gap: Spacing.sm,
            alignItems: 'center',
        },
        countryCode: {
            height: 48,
            paddingHorizontal: Spacing.md,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        countryCodeText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
        phoneInputWrapper: { flex: 1 },
        phoneCountHint: {
            fontSize: FontSize.xs,
            fontFamily: FontFamily.medium,
            marginLeft: 4,
        },
        sendOtpBtn: {
            flexDirection: 'row',
            height: 48,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
        },
        sendOtpBtnText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },

        // ── OTP ──
        otpSection: { gap: Spacing.md },
        otpLabel: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            lineHeight: 20,
        },
        otpRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        otpBox: {
            flex: 1,
            height: 52,
            borderRadius: BorderRadius.md,
            borderWidth: 1.5,
            fontSize: FontSize.xl,
            fontFamily: FontFamily.bold,
            textAlign: 'center',
        },
        resendRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Spacing.sm,
        },
        resendText: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
        },
        resendAction: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.bold,
        },

        // ── Verified ──
        verifiedContainer: {
            alignItems: 'center',
            paddingVertical: Spacing.xxl,
            gap: Spacing.md,
        },
        verifiedCircle: {
            width: 100,
            height: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.sm,
        },
        verifiedTitle: {
            fontSize: FontSize.xxl,
            fontFamily: FontFamily.bold,
        },
        verifiedNumber: {
            fontSize: FontSize.lg,
            fontFamily: FontFamily.medium,
        },
        verifiedHint: {
            fontSize: FontSize.sm,
            fontFamily: FontFamily.regular,
            textAlign: 'center',
        },

        // ── Error ──
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

        // ── Bottom Bar ──
        bottomBar: {
            flexDirection: 'row',
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.lg,
            paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.lg,
            borderTopWidth: 1,
            gap: Spacing.md,
        },
        backButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            gap: Spacing.xs,
        },
        backButtonText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.semiBold,
        },
        cancelButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: BorderRadius.md,
            borderWidth: 1,
            gap: Spacing.xs,
        },
        cancelButtonText: {
            fontSize: FontSize.md,
            fontFamily: FontFamily.semiBold,
        },
        nextButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 48,
            borderRadius: BorderRadius.md,
            gap: Spacing.xs,
        },
        nextButtonText: {
            color: '#FFF',
            fontSize: FontSize.md,
            fontFamily: FontFamily.bold,
        },
    });
