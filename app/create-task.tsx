/**
 * create-task.tsx — Multi-step task creation screen.
 *
 * Three steps:
 *  1. **Basics** — title, description, budget (negotiable toggle),
 *     urgency, and media upload (images/videos to Supabase Storage).
 *  2. **Location** — auto-detect via `expo-location`, or manual input.
 *  3. **Categories** — select one or more predefined categories.
 *
 * Media files are uploaded using `fetch(uri)` → Blob → Supabase storage.
 * This avoids loading the entire file into memory as base64, preventing OOM
 * crashes on large videos. If the task insert fails, uploaded files are rolled back.
 */

import { AnimatedInput } from '@/components/AnimatedInput';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeInRight,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedView = Animated.createAnimatedComponent(View);
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PLATFORM_FEE = 5;
const MAX_IMAGES = 6;
const MAX_VIDEOS = 2;
const MAX_VIDEO_SIZE_MB = 50;
const MIN_BUDGET = 50;
const MAX_BUDGET = 5500;

const CATEGORIES = [
    'General', 'Pick-Up', 'Delivery', 'Cleaning', 'Laundry',
    'Home', 'Office', 'Pet Care', 'Event Help', 'Tutoring',
    'Carrying', 'Repair', 'Others',
];

const URGENCY_LEVELS = [
    { key: 'low' as const, label: 'Low', color: '#4CAF50', icon: 'time-outline' as const },
    { key: 'mid' as const, label: 'Mid', color: '#FF9800', icon: 'alert-circle-outline' as const },
    { key: 'urgent' as const, label: 'Urgent', color: '#F44336', icon: 'flash-outline' as const },
];

interface MediaItem {
    uri: string;
    type: 'image' | 'video';
    fileName?: string;
    fileSize?: number;
    uploading?: boolean;
    progress?: number;
}

export default function CreateTaskScreen() {
    const { colors } = useTheme();
    const { addTask } = useTasks();
    const { user } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // ── Form State ──
    const [step, setStep] = useState(0);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [budget, setBudget] = useState('');
    const [building, setBuilding] = useState('');
    const [locality, setLocality] = useState('');
    const [extraDescription, setExtraDescription] = useState('');
    const [showExtraDesc, setShowExtraDesc] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['General']);
    const [urgency, setUrgency] = useState<'low' | 'mid' | 'urgent' | null>(null);
    const [negotiable, setNegotiable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

    // ── Map State ──
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [locationDetecting, setLocationDetecting] = useState(false);
    const [detectedAddress, setDetectedAddress] = useState('');

    // ── Summary Modal State ──
    const [summaryVisible, setSummaryVisible] = useState(false);

    // ── Animations ──
    const submitScale = useSharedValue(1);
    const budgetHighlight = useSharedValue(0);

    const submitAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: submitScale.value }],
    }));

    const budgetCardStyle = useAnimatedStyle(() => ({
        borderColor: interpolateColor(
            budgetHighlight.value,
            [0, 1, 2],
            [colors.border, '#4CAF50', '#FF9800']
        ),
        backgroundColor: interpolateColor(
            budgetHighlight.value,
            [0, 1, 2],
            [colors.card, 'rgba(76, 175, 80, 0.08)', 'rgba(255, 152, 0, 0.08)']
        ),
    }));

    // ── Budget Logic ──
    const budgetNum = parseInt(budget) || 0;
    const totalPayable = budgetNum > 0 ? budgetNum + PLATFORM_FEE : 0;
    const isBudgetOutOfRange = budget.length > 0 && (budgetNum < MIN_BUDGET || budgetNum > MAX_BUDGET);
    const isBudgetValid = budgetNum >= MIN_BUDGET && budgetNum <= MAX_BUDGET;

    useEffect(() => {
        if (isBudgetOutOfRange) {
            // Yellow warning state
            budgetHighlight.value = withTiming(2, { duration: 400 });
        } else if (budgetNum > 0) {
            budgetHighlight.value = withTiming(1, { duration: 400 });
        } else {
            budgetHighlight.value = withTiming(0, { duration: 400 });
        }
    }, [budgetNum, isBudgetOutOfRange]);

    const handleBudgetChange = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned === '' || parseInt(cleaned) >= 0) {
            setBudget(cleaned);
        }
    };

    // ── Media Handling ──
    const imageCount = mediaItems.filter((m) => m.type === 'image').length;
    const videoCount = mediaItems.filter((m) => m.type === 'video').length;

    const pickMedia = async (type: 'image' | 'video') => {
        if (type === 'image' && imageCount >= MAX_IMAGES) {
            Alert.alert('Limit reached', `You can upload up to ${MAX_IMAGES} images.`);
            return;
        }
        if (type === 'video' && videoCount >= MAX_VIDEOS) {
            Alert.alert('Limit reached', `You can upload up to ${MAX_VIDEOS} videos.`);
            return;
        }

        const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permResult.granted) {
            Alert.alert('Permission required', 'Please grant access to your media library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'image'
                ? ['images' as ImagePicker.MediaType]
                : ['videos' as ImagePicker.MediaType],
            allowsMultipleSelection: type === 'image',
            selectionLimit: type === 'image' ? MAX_IMAGES - imageCount : 1,
            quality: 0.7,
            videoMaxDuration: 120,
        });

        if (result.canceled) return;

        const newItems: MediaItem[] = [];
        for (const asset of result.assets) {
            if (type === 'video' && asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
                Alert.alert('File too large', `Video must be less than ${MAX_VIDEO_SIZE_MB}MB.`);
                continue;
            }
            newItems.push({
                uri: asset.uri,
                type,
                fileName: asset.fileName ?? `media_${Date.now()}`,
                fileSize: asset.fileSize,
                uploading: false,
                progress: 0,
            });
        }

        setMediaItems((prev) => [...prev, ...newItems]);
    };

    const removeMedia = (index: number) => {
        setMediaItems((prev) => prev.filter((_, i) => i !== index));
    };

    const uploadMediaToStorage = async (): Promise<{ urls: string[]; paths: string[] }> => {
        if (!user || mediaItems.length === 0) return { urls: [], paths: [] };

        const uploadedPaths: string[] = [];

        setMediaItems((prev) => prev.map((m) => ({ ...m, uploading: true, progress: 0 })));
        setUploadProgress({ current: 0, total: mediaItems.length });

        const timestamp = Date.now();

        const getMimeType = (name: string, type: 'image' | 'video'): string => {
            const ext = name.split('.').pop()?.split('?')[0]?.toLowerCase();
            const map: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', gif: 'image/gif',
                mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
            };
            return (ext && map[ext]) ? map[ext] : (type === 'image' ? 'image/jpeg' : 'video/mp4');
        };

        const uploadSingle = async (item: MediaItem, i: number) => {
            const ext = item.uri.split('.').pop()?.split('?')[0]?.toLowerCase() || (item.type === 'image' ? 'jpg' : 'mp4');
            const contentType = getMimeType(item.uri, item.type);
            const fileName = `${timestamp}_${i}.${ext}`;
            const storagePath = `tasks/${user.id}/${fileName}`;

            // Verify session is still valid before uploading
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                throw new Error('Session expired. Please sign in again.');
            }

            if (__DEV__) {
                console.log(`[MediaUpload] Uploading ${item.type} #${i}: ${storagePath} (${contentType})`);
            }

            // Use FormData with React Native's native file reference.
            // RN's networking layer streams files directly to the endpoint,
            // avoiding the Blob serialisation bug that causes "Network request failed".
            const formData = new FormData();
            formData.append('', {
                uri: item.uri,
                name: fileName,
                type: contentType,
            } as any);

            const { data, error } = await supabase.storage
                .from('task-media')
                .upload(storagePath, formData, {
                    contentType: 'multipart/form-data',
                    upsert: false,
                });

            if (error) {
                if (__DEV__) {
                    console.error(`[MediaUpload] Supabase error for #${i}:`, error.message, error);
                }
                throw new Error(error.message);
            }

            uploadedPaths.push(data.path);

            const { data: urlData } = supabase.storage
                .from('task-media')
                .getPublicUrl(data.path);

            setMediaItems((prev) =>
                prev.map((m, idx) => idx === i ? { ...m, progress: 100, uploading: false } : m)
            );
            setUploadProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null);

            return { url: urlData.publicUrl, path: data.path };
        };

        try {
            const results = await Promise.all(
                mediaItems.map((item, i) => uploadSingle(item, i))
            );

            setUploadProgress(null);
            return {
                urls: results.map((r) => r.url),
                paths: results.map((r) => r.path),
            };
        } catch (err: any) {
            if (__DEV__) console.warn('[MediaUpload] Upload failed:', err);

            if (uploadedPaths.length > 0) {
                await supabase.storage.from('task-media').remove(uploadedPaths).catch(() => {});
            }

            setMediaItems((prev) => prev.map((m) => ({ ...m, uploading: false, progress: 0 })));
            setUploadProgress(null);
            throw new Error(err.message || 'Media upload failed');
        }
    };

    // ── Location Handling ──
    const detectTaskLocation = async () => {
        setLocationDetecting(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Location permission is needed to detect your position.');
                setLocationDetecting(false);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            setSelectedLocation(coords);
            try {
                const [result] = await Location.reverseGeocodeAsync(coords);
                if (result) {
                    const parts = [result.name, result.district, result.subregion, result.city].filter(Boolean);
                    const address = parts.join(', ') || 'Detected Location';
                    setDetectedAddress(address);
                    setLocality(address);
                }
            } catch {
                setLocality('Detected Location');
                setDetectedAddress('Detected Location');
            }
        } catch {
            Alert.alert('Location Error', 'Could not get your location. Please enter the address manually.');
        }
        setLocationDetecting(false);
    };

    // ── Categories ──
    const toggleCategory = (cat: string) => {
        if (selectedCategories.includes(cat)) {
            setSelectedCategories((prev) => prev.filter((c) => c !== cat));
        } else if (selectedCategories.length < 3) {
            setSelectedCategories((prev) => [...prev, cat]);
        }
    };

    // ── Submission ──
    const handleSubmitPress = () => {
        if (!isFormValid) {
            Alert.alert('Incomplete Form', 'Please fill in all required fields (Title, Description, and a valid Budget between ₹50 - ₹5,500).');
            return;
        }
        setSummaryVisible(true);
    };

    const handleConfirmSubmit = async () => {
        setSummaryVisible(false);
        setLoading(true);
        submitScale.value = withSequence(
            withSpring(0.95, { damping: 15 }),
            withSpring(1, { damping: 15 })
        );

        try {
            // Step 1: Upload all media (transactional — all or nothing)
            let mediaUrls: string[] = [];
            let mediaPaths: string[] = [];

            if (mediaItems.length > 0) {
                const result = await uploadMediaToStorage();
                mediaUrls = result.urls;
                mediaPaths = result.paths;
            }

            // Step 2: Insert task into database only after all uploads succeed
            const taskResult = await addTask({
                title: title || 'New Task',
                description: description || null,
                budget: budgetNum,
                location: building || null,
                locality: locality || null,
                categories: selectedCategories,
                urgency,
                negotiable,
                extra_description: extraDescription || null,
                media_urls: mediaUrls.length > 0 ? mediaUrls : null,
                latitude: selectedLocation?.latitude ?? null,
                longitude: selectedLocation?.longitude ?? null,
            });

            if (taskResult.error) {
                // Rollback: clean up uploaded media if task insert fails
                if (mediaPaths.length > 0) {
                    await supabase.storage.from('task-media').remove(mediaPaths).catch(() => {});
                }
                Alert.alert('Error', taskResult.error);
            } else {
                Alert.alert('Success', 'Your task has been created successfully!', [
                    { text: 'OK', onPress: () => router.back() },
                ]);
            }
        } catch (err: any) {
            Alert.alert(
                'Upload Error',
                err.message || 'Failed to upload media. Task was not created. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const canContinue = () => {
        if (step === 0) {
            return title.trim().length > 0 && description.trim().length > 0 && isBudgetValid;
        }
        return true;
    };

    const isFormValid = title.trim().length > 0 && description.trim().length > 0 && isBudgetValid;

    const STEP_TITLES = ['Task Basics', 'Task Location', 'Category & Options'];

    // ═══════════════════════════════════════════════════════════
    // STEP 0 — Task Basics: Info, Budget, Media
    // ═══════════════════════════════════════════════════════════
    const renderStep0 = () => (
        <Animated.View entering={FadeInRight.duration(400)} key="step0">
            {/* Task Information */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="pricetag" size={20} color={colors.accent} />
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Task Information
                    </Text>
                </View>

                <AnimatedInput
                    label="Task Title"
                    required
                    placeholder="What do you need help with?"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                />
                <Text style={{ alignSelf: 'flex-end', fontSize: FontSize.xs, color: title.length >= 55 ? colors.accent : colors.textMuted, fontFamily: FontFamily.regular, marginTop: -Spacing.sm, marginBottom: Spacing.sm }}>
                    {title.length}/60
                </Text>
                <AnimatedInput
                    label="Description"
                    required
                    placeholder="Describe your task in detail..."
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={4}
                    maxLength={600}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
                <Text style={{ alignSelf: 'flex-end', fontSize: FontSize.xs, color: description.length >= 550 ? colors.accent : colors.textMuted, fontFamily: FontFamily.regular, marginTop: -Spacing.sm, marginBottom: Spacing.sm }}>
                    {description.length}/600
                </Text>
            </View>

            {/* Budget */}
            <AnimatedView style={[styles.sectionCard, budgetCardStyle, { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.xl }]}>
                <View style={styles.budgetHeader}>
                    <Text style={[styles.budgetLabel, { color: isBudgetOutOfRange ? '#FF9800' : (isBudgetValid ? '#4CAF50' : colors.accent), fontFamily: FontFamily.bold }]}>
                        Budget (₹)
                    </Text>
                    <Text style={[styles.budgetRange, { color: isBudgetOutOfRange ? '#FF9800' : (isBudgetValid ? '#4CAF50' : colors.accent), fontFamily: FontFamily.regular }]}>
                        Range: ₹50 - ₹5,500
                    </Text>
                </View>
                <AnimatedInput
                    label="Budget"
                    required
                    placeholder="₹0"
                    value={budget}
                    onChangeText={handleBudgetChange}
                    keyboardType="numeric"
                />
                {isBudgetOutOfRange && (
                    <Animated.View entering={FadeIn.duration(300)}>
                        <View style={[styles.feeNote, { backgroundColor: 'rgba(255, 152, 0, 0.1)', borderColor: 'rgba(255, 152, 0, 0.3)' }]}>
                            <Ionicons name="warning" size={16} color="#FF9800" />
                            <Text style={[styles.feeNoteText, { color: '#FF9800', fontFamily: FontFamily.medium }]}>
                                Budget must be between ₹{MIN_BUDGET} and ₹{MAX_BUDGET}
                            </Text>
                        </View>
                    </Animated.View>
                )}
                {isBudgetValid && (
                    <Animated.View entering={FadeIn.duration(300)}>
                        <View style={[styles.feeNote, { backgroundColor: 'rgba(76, 175, 80, 0.1)', borderColor: 'rgba(76, 175, 80, 0.3)' }]}>
                            <Ionicons name="information-circle" size={16} color="#4CAF50" />
                            <Text style={[styles.feeNoteText, { color: '#4CAF50', fontFamily: FontFamily.medium }]}>
                                Total payable amount: ₹{totalPayable} (includes ₹{PLATFORM_FEE} platform fee)
                            </Text>
                        </View>
                    </Animated.View>
                )}
            </AnimatedView>

            {/* Task Media */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="images" size={20} color={colors.accent} />
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Task Media
                    </Text>
                    <Text style={[styles.selectHint, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        (Optional)
                    </Text>
                </View>

                {/* Media Thumbnails Grid */}
                {mediaItems.length > 0 && (
                    <View style={styles.mediaGrid}>
                        {mediaItems.map((item, index) => (
                            <Animated.View key={`${item.uri}-${index}`} entering={FadeIn.duration(300)} style={styles.mediaThumbnailContainer}>
                                <Image source={{ uri: item.uri }} style={styles.mediaThumbnail} />
                                {item.type === 'video' && (
                                    <View style={styles.videoOverlay}>
                                        <Ionicons name="play-circle" size={28} color="#FFF" />
                                    </View>
                                )}
                                {item.uploading && (
                                    <View style={styles.uploadOverlay}>
                                        <ActivityIndicator color="#FFF" size="small" />
                                        <Text style={styles.uploadProgressText}>{item.progress ?? 0}%</Text>
                                    </View>
                                )}
                                <Pressable style={styles.removeMediaButton} onPress={() => removeMedia(index)}>
                                    <Ionicons name="close-circle" size={22} color="#F44336" />
                                </Pressable>
                            </Animated.View>
                        ))}
                    </View>
                )}

                {/* Add Media Buttons */}
                <View style={styles.mediaButtonsRow}>
                    <Pressable
                        style={[styles.addMediaBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: imageCount >= MAX_IMAGES ? 0.4 : 1 }]}
                        onPress={() => pickMedia('image')}
                        disabled={imageCount >= MAX_IMAGES}
                    >
                        <Ionicons name="camera-outline" size={20} color={colors.accent} />
                        <Text style={[styles.addMediaText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Images ({imageCount}/{MAX_IMAGES})
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.addMediaBtn, { backgroundColor: colors.inputBackground, borderColor: colors.border, opacity: videoCount >= MAX_VIDEOS ? 0.4 : 1 }]}
                        onPress={() => pickMedia('video')}
                        disabled={videoCount >= MAX_VIDEOS}
                    >
                        <Ionicons name="videocam-outline" size={20} color={colors.accent} />
                        <Text style={[styles.addMediaText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            Videos ({videoCount}/{MAX_VIDEOS})
                        </Text>
                    </Pressable>
                </View>
                <Text style={[styles.mediaHint, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                    Up to 6 images and 2 videos (each video &lt; 1 GB)
                </Text>
            </View>
        </Animated.View>
    );

    // ═══════════════════════════════════════════════════════════
    // STEP 1 — Location
    // ═══════════════════════════════════════════════════════════
    const renderStep1 = () => (
        <Animated.View entering={FadeInRight.duration(400)} key="step1">
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="location" size={20} color={colors.accent} />
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Task Location
                    </Text>
                </View>

                <Text style={[styles.subLabel, { color: colors.text, fontFamily: FontFamily.medium }]}>
                    Detect location automatically
                </Text>
                <Pressable
                    style={[styles.mapButton, { backgroundColor: colors.inputBackground, borderColor: selectedLocation ? colors.accent : colors.border }]}
                    onPress={detectTaskLocation}
                    disabled={locationDetecting}
                >
                    {locationDetecting ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <>
                            <Text style={[styles.mapButtonText, { color: selectedLocation ? colors.text : colors.textMuted, fontFamily: FontFamily.regular, flex: 1 }]}>
                                {selectedLocation ? `📍 ${detectedAddress || 'Location detected'}` : 'Detect My Location'}
                            </Text>
                            <Ionicons name={selectedLocation ? 'checkmark-circle' : 'locate'} size={20} color={selectedLocation ? colors.accent : colors.textMuted} />
                        </>
                    )}
                </Pressable>
                {selectedLocation && (
                    <Animated.View entering={FadeIn.duration(200)}>
                        <Text style={{ fontSize: FontSize.xs, color: colors.textMuted, fontFamily: FontFamily.regular, marginTop: Spacing.xs, marginLeft: 4 }}>
                            {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                        </Text>
                    </Animated.View>
                )}

                <Text style={[styles.orText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                    - OR -
                </Text>

                <Text style={[styles.subLabel, { color: colors.text, fontFamily: FontFamily.medium }]}>
                    Enter address details manually
                </Text>

                <AnimatedInput
                    label="House/Building Name"
                    placeholder="Eg: Vanlawn Building, Flat 302"
                    value={building}
                    onChangeText={setBuilding}
                />
                <AnimatedInput
                    label="Locality/Area"
                    placeholder="Eg: Zarkawt, Aizawl"
                    value={locality}
                    onChangeText={setLocality}
                />

                {/* More Description Toggle */}
                <Pressable onPress={() => setShowExtraDesc(!showExtraDesc)} style={styles.moreDescToggle}>
                    <Text style={[styles.moreDescText, { color: colors.accent, fontFamily: FontFamily.medium }]}>
                        {showExtraDesc ? 'Less Description −' : 'More Description +'}
                    </Text>
                </Pressable>

                {showExtraDesc && (
                    <Animated.View entering={FadeInDown.duration(300)}>
                        <AnimatedInput
                            label="Additional Location Details"
                            placeholder="Landmarks, building details, floor number, etc."
                            value={extraDescription}
                            onChangeText={setExtraDescription}
                            multiline
                            numberOfLines={3}
                            style={{ minHeight: 80, textAlignVertical: 'top' }}
                        />
                    </Animated.View>
                )}
            </View>
        </Animated.View>
    );

    // ═══════════════════════════════════════════════════════════
    // STEP 2 — Categories, Urgency, Negotiation
    // ═══════════════════════════════════════════════════════════
    const renderStep2 = () => (
        <Animated.View entering={FadeInRight.duration(400)} key="step2">
            {/* Categories */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="layers" size={20} color={colors.accent} />
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Task Category
                    </Text>
                    <Text style={[styles.selectHint, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        (Select up to 3)
                    </Text>
                </View>

                <View style={styles.categoriesGrid}>
                    {CATEGORIES.map((cat, index) => {
                        const isSelected = selectedCategories.includes(cat);
                        return (
                            <Animated.View key={cat} entering={FadeInDown.duration(300).delay(index * 40)}>
                                <Pressable
                                    style={[
                                        styles.categoryChip,
                                        {
                                            backgroundColor: isSelected ? colors.accent : colors.inputBackground,
                                            borderColor: isSelected ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={() => toggleCategory(cat)}
                                >
                                    <Text
                                        style={[
                                            styles.categoryText,
                                            {
                                                color: isSelected ? '#FFF' : colors.textSecondary,
                                                fontFamily: isSelected ? FontFamily.semiBold : FontFamily.regular,
                                            },
                                        ]}
                                    >
                                        {cat}
                                    </Text>
                                </Pressable>
                            </Animated.View>
                        );
                    })}
                </View>
            </View>

            {/* Urgency Level */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="speedometer" size={20} color={colors.accent} />
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Urgency Level
                    </Text>
                    <Text style={[styles.selectHint, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                        (Optional)
                    </Text>
                </View>

                <View style={styles.urgencyRow}>
                    {URGENCY_LEVELS.map((level) => {
                        const isActive = urgency === level.key;
                        return (
                            <Pressable
                                key={level.key}
                                style={[
                                    styles.urgencyOption,
                                    {
                                        backgroundColor: isActive ? level.color : colors.inputBackground,
                                        borderColor: isActive ? level.color : colors.border,
                                    },
                                ]}
                                onPress={() => setUrgency(isActive ? null : level.key)}
                            >
                                <Ionicons
                                    name={level.icon}
                                    size={20}
                                    color={isActive ? '#FFF' : level.color}
                                />
                                <Text
                                    style={[
                                        styles.urgencyText,
                                        {
                                            color: isActive ? '#FFF' : colors.text,
                                            fontFamily: isActive ? FontFamily.bold : FontFamily.medium,
                                        },
                                    ]}
                                >
                                    {level.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {/* Negotiation Toggle */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.negotiationRow}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs }}>
                            <Ionicons name="swap-horizontal" size={20} color={colors.accent} />
                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Allow Negotiation
                            </Text>
                        </View>
                        <Text style={[styles.negotiationHint, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            Let taskers propose a different price
                        </Text>
                    </View>
                    <Switch
                        value={negotiable}
                        onValueChange={setNegotiable}
                        trackColor={{ false: colors.border, true: 'rgba(76, 175, 80, 0.4)' }}
                        thumbColor={negotiable ? '#4CAF50' : colors.textMuted}
                    />
                </View>
            </View>
        </Animated.View>
    );

    // ═══════════════════════════════════════════════════════════
    // SUMMARY CONFIRMATION MODAL
    // ═══════════════════════════════════════════════════════════
    const renderSummaryModal = () => (
        <Modal
            visible={summaryVisible}
            animationType="slide"
            transparent
            onRequestClose={() => setSummaryVisible(false)}
        >
            <View style={styles.summaryOverlay}>
                <Animated.View
                    entering={FadeIn.duration(300)}
                    style={[styles.summaryModal, { backgroundColor: colors.card }]}
                >
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.summaryModalHeader}>
                            <Ionicons name="document-text" size={24} color={colors.accent} />
                            <Text style={[styles.summaryModalTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                                Task Summary
                            </Text>
                        </View>

                        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

                        {/* Summary Rows */}
                        <SummaryRow label="Title" value={title || '—'} colors={colors} />
                        <SummaryRow label="Description" value={description || '—'} colors={colors} />
                        <SummaryRow label="Budget" value={`₹${budgetNum}`} accent colors={colors} />
                        {budgetNum > 0 && (
                            <SummaryRow label="Total Payable" value={`₹${totalPayable} (incl. ₹${PLATFORM_FEE} fee)`} accent colors={colors} />
                        )}
                        <SummaryRow label="Location" value={locality || building || 'Not set'} colors={colors} />
                        {extraDescription ? (
                            <SummaryRow label="Extra Details" value={extraDescription} colors={colors} />
                        ) : null}
                        <SummaryRow label="Categories" value={selectedCategories.join(', ') || 'None'} colors={colors} />
                        <SummaryRow label="Urgency" value={urgency ? urgency.charAt(0).toUpperCase() + urgency.slice(1) : 'Not set'} colors={colors} />
                        <SummaryRow label="Negotiable" value={negotiable ? 'Yes' : 'No'} colors={colors} />
                        <SummaryRow label="Media" value={`${imageCount} image(s), ${videoCount} video(s)`} colors={colors} />

                        <View style={[styles.summaryDivider, { backgroundColor: colors.border, marginTop: Spacing.lg }]} />
                    </ScrollView>

                    {/* Modal Actions */}
                    <View style={styles.summaryActions}>
                        <Pressable
                            style={[styles.cancelButton, { borderColor: colors.border, flex: 1 }]}
                            onPress={() => setSummaryVisible(false)}
                        >
                            <Text style={[styles.cancelText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                                Edit
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.continueButton, { backgroundColor: colors.accent, flex: 1.5 }]}
                            onPress={handleConfirmSubmit}
                        >
                            <Text style={[styles.continueText, { fontFamily: FontFamily.bold }]}>
                                Confirm & Submit
                            </Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Header */}
                <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        Create Task
                    </Text>
                    <View style={{ width: 40 }} />
                </Animated.View>

                {/* Step Title + Indicator */}
                <View style={styles.stepRow}>
                    <Text style={[styles.stepTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                        {STEP_TITLES[step]}
                    </Text>
                    <View style={styles.stepIndicator}>
                        {[0, 1, 2].map((i) => (
                            <View
                                key={i}
                                style={[
                                    styles.stepDot,
                                    {
                                        backgroundColor: i <= step ? colors.accent : colors.border,
                                        width: i === step ? 12 : 10,
                                        height: i === step ? 12 : 10,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 0 && renderStep0()}
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                </ScrollView>

                {/* Bottom Actions */}
                <View style={[styles.bottomBar, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
                    <Pressable
                        style={[styles.cancelButton, { borderColor: colors.border }]}
                        onPress={() => {
                            if (step > 0) setStep(step - 1);
                            else router.back();
                        }}
                    >
                        <Text style={[styles.cancelText, { color: colors.text, fontFamily: FontFamily.medium }]}>
                            {step > 0 ? 'Back' : 'Cancel'}
                        </Text>
                    </Pressable>

                    {step < 2 ? (
                        <Pressable
                            style={[
                                styles.continueButton,
                                { backgroundColor: canContinue() ? colors.accent : colors.border },
                            ]}
                            onPress={() => setStep(step + 1)}
                            disabled={!canContinue()}
                        >
                            <Text style={[styles.continueText, { fontFamily: FontFamily.bold }]}>Continue</Text>
                        </Pressable>
                    ) : (
                        <Animated.View style={submitAnimatedStyle}>
                            <Pressable
                                style={[styles.continueButton, { backgroundColor: isFormValid ? colors.accent : colors.border }]}
                                onPress={handleSubmitPress}
                                disabled={loading || !isFormValid}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={[styles.continueText, { fontFamily: FontFamily.bold }]}>Submit</Text>
                                )}
                            </Pressable>
                        </Animated.View>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Modals */}
            {renderSummaryModal()}
        </SafeAreaView>
    );
}

// ── Summary Row Component ──
function SummaryRow({ label, value, accent, colors }: { label: string; value: string; accent?: boolean; colors: any }) {
    return (
        <View style={srStyles.row}>
            <Text style={[srStyles.label, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>{label}</Text>
            <Text
                style={[srStyles.value, { color: accent ? colors.accent : colors.text, fontFamily: accent ? FontFamily.bold : FontFamily.medium }]}
                numberOfLines={2}
            >
                {value}
            </Text>
        </View>
    );
}

const srStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.sm + 2,
        alignItems: 'flex-start',
    },
    label: {
        fontSize: FontSize.md,
        flex: 0.4,
    },
    value: {
        fontSize: FontSize.md,
        flex: 0.6,
        textAlign: 'right',
    },
});

// ── Styles ──
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: FontSize.xl,
        textAlign: 'center',
    },
    stepRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    stepTitle: {
        fontSize: FontSize.xxl,
    },
    stepIndicator: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'center',
    },
    stepDot: {
        borderRadius: 6,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.huge,
    },
    sectionCard: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.xl,
        borderWidth: 1,
        marginBottom: Spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        fontSize: FontSize.lg,
    },
    selectHint: {
        fontSize: FontSize.sm,
    },
    subLabel: {
        fontSize: FontSize.md,
        marginBottom: Spacing.sm,
    },
    mapButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md + 2,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    mapButtonText: {
        fontSize: FontSize.md,
    },
    orText: {
        textAlign: 'center',
        marginVertical: Spacing.lg,
        fontSize: FontSize.sm,
    },
    budgetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    budgetLabel: {
        fontSize: FontSize.lg,
    },
    budgetRange: {
        fontSize: FontSize.sm,
    },
    feeNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
    },
    feeNoteText: {
        fontSize: FontSize.sm,
        flex: 1,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    categoryChip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm + 2,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
    },
    categoryText: {
        fontSize: FontSize.sm,
    },
    // ── Urgency ──
    urgencyRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    urgencyOption: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        gap: Spacing.xs,
    },
    urgencyText: {
        fontSize: FontSize.sm,
    },
    // ── Negotiation ──
    negotiationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    negotiationHint: {
        fontSize: FontSize.sm,
    },
    // ── Media ──
    mediaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    mediaThumbnailContainer: {
        width: (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.xl * 2 - Spacing.sm * 2) / 3,
        aspectRatio: 1,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaThumbnail: {
        width: '100%',
        height: '100%',
        borderRadius: BorderRadius.sm,
    },
    videoOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    uploadOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    uploadProgressText: {
        color: '#FFF',
        fontSize: FontSize.xs,
        marginTop: 4,
    },
    removeMediaButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
    },
    mediaButtonsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    addMediaBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        gap: Spacing.sm,
    },
    addMediaText: {
        fontSize: FontSize.sm,
    },
    mediaHint: {
        fontSize: FontSize.xs,
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
    // ── More Description ──
    moreDescToggle: {
        marginTop: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    moreDescText: {
        fontSize: FontSize.md,
    },
    // ── Summary Modal ──
    summaryOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    summaryModal: {
        maxHeight: SCREEN_HEIGHT * 0.75,
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.xl,
    },
    summaryModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    summaryModalTitle: {
        fontSize: FontSize.xl,
    },
    summaryDivider: {
        height: 1,
        marginVertical: Spacing.sm,
    },
    summaryActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.lg,
    },
    // ── Bottom Bar ──
    bottomBar: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
        borderTopWidth: 1,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        borderWidth: 1,
    },
    cancelText: {
        fontSize: FontSize.md,
    },
    continueButton: {
        flex: 1.5,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
    },
    continueText: {
        color: '#FFFFFF',
        fontSize: FontSize.md,
    },
});
