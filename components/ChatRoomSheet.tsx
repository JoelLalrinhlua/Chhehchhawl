/**
 * ChatRoomSheet.tsx — Full-screen modal for an individual chat conversation.
 *
 * Features:
 *  • Message history with real-time updates via Supabase Realtime
 *  • Inverted FlatList for chat-style scrolling
 *  • Blue bubbles (own), Green bubbles (other)
 *  • Image messages with inline preview, loading, error states
 *  • Location share messages as tappable map cards
 *  • "+" attachment button with Photos & Location Sharing menu
 *  • Photo picker with compression & 10MB limit
 *  • Live location sharing (request/accept/deny/view/stop)
 *  • Completion flow (mark complete / confirm), chat lock
 *  • Task detail access via header button
 */

import { CustomAlert, type AlertButton } from '@/components/CustomAlert';
import { TaskDetailSheet } from '@/components/TaskDetailSheet';
import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks, type Task } from '@/contexts/TaskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import {
    useChatMessagesQuery,
    useLiveLocationSessionQuery,
    type ChatMessage,
    type ImageMessageMetadata,
    type LocationShareMetadata,
    type LiveLocationMetadata,
    type LiveLocationSession,
} from '@/hooks/use-chat-queries';
import {
    useConfirmPaymentReceivedMutation,
    useFinishTaskMutation,
    useMarkMessagesSeenMutation,
    useMarkPaymentSentMutation,
    useOfferLiveLocationMutation,
    useRequestLiveLocationMutation,
    useRespondLiveLocationMutation,
    useSendMessageMutation,
    useStopLiveLocationMutation,
    useUpdateLiveLocationMutation,
} from '@/hooks/use-mutations';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebView } from 'react-native-webview';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_BLUE = '#2B6CB0';
const BUBBLE_GREEN = '#2F855A';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Builds a reliable OpenStreetMap tile URL for a given lat/lng at zoom 15.
 * Uses tile.openstreetmap.org — far more reliable than static map generators.
 */
function getOsmTileUrl(lat: number, lng: number, zoom: number = 15) {
    const n = Math.pow(2, zoom);
    const xtile = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const ytile = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return `https://tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;
}

/**
 * Static map thumbnail built from a real OSM raster tile.
 * Always works without WebView — shows the tile at zoom 15 with a centred pin.
 */
function OsmTileMapImage({ lat, lng, height = 120 }: { lat: number; lng: number; height?: number }) {
    const [loading, setLoading] = React.useState(true);
    const [errored, setErrored] = React.useState(false);
    const tileUrl = getOsmTileUrl(lat, lng, 15);

    if (errored) {
        return (
            <View style={{ height, backgroundColor: '#c8e0c8', justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="map-outline" size={32} color="#4a7a5a" />
                <Text style={{ fontSize: 11, color: '#4a7a5a', marginTop: 4 }}>Map unavailable</Text>
            </View>
        );
    }
    return (
        <View style={{ height, overflow: 'hidden' }}>
            <Image
                source={{ uri: tileUrl, headers: { 'User-Agent': 'ChhehchhawlApp/1.0' } }}
                style={{ width: '100%', height: height + 60, marginTop: -30 }}
                resizeMode="cover"
                onLoadEnd={() => setLoading(false)}
                onError={() => { setLoading(false); setErrored(true); }}
            />
            {/* Centered pin overlay */}
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 28, marginBottom: 14 }}>📍</Text>
            </View>
            {loading && (
                <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#c8e0c8', justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#4a7a5a" />
                </View>
            )}
        </View>
    );
}


interface ChatRoomSheetProps {
    roomId: string;
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    otherUserName: string | null;
    taskerCompleted: boolean;
    posterConfirmed: boolean;
    posterId: string;
    taskerId: string;
    taskBudget: number;
    taskerUpiId: string | null;
    visible: boolean;
    onClose: () => void;
}

export function ChatRoomSheet({
    roomId,
    taskId,
    taskTitle,
    taskStatus,
    otherUserName,
    taskerCompleted,
    posterConfirmed,
    posterId,
    taskerId,
    taskBudget,
    taskerUpiId,
    visible,
    onClose,
}: ChatRoomSheetProps) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const { tasks } = useTasks();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();
    const [messageText, setMessageText] = useState('');
    const [completionLoading, setCompletionLoading] = useState(false);
    const [taskDetailVisible, setTaskDetailVisible] = useState(false);
    const [taskerInfoVisible, setTaskerInfoVisible] = useState(false);
    const [attachMenuVisible, setAttachMenuVisible] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [liveMapSession, setLiveMapSession] = useState<LiveLocationSession | null>(null);
    const [showLiveMap, setShowLiveMap] = useState(false);
    const [mapPickerVisible, setMapPickerVisible] = useState(false);
    const [pickedLocation, setPickedLocation] = useState<{lat: number, lng: number} | null>(null);
    // Custom alert state
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean; title: string; message: string;
        variant: 'confirm' | 'payment' | 'error' | 'info' | 'destructive';
        buttons: AlertButton[];
    }>({ visible: false, title: '', message: '', variant: 'confirm', buttons: [] });
    const closeAlert = () => setAlertConfig((p) => ({ ...p, visible: false }));
    const attachMenuAnim = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef<FlatList<ChatMessage>>(null);
    const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
    const composerTranslateY = useRef(new Animated.Value(0)).current;
    const [composerHeight, setComposerHeight] = useState(0);

    const { data: messages = [] } = useChatMessagesQuery(roomId, visible);
    const { data: liveSession } = useLiveLocationSessionQuery(roomId, visible);
    const sendMutation = useSendMessageMutation(user?.id);
    const markSeenMutation = useMarkMessagesSeenMutation();
    const finishMutation = useFinishTaskMutation(user?.id);
    const markPaymentSentMutation = useMarkPaymentSentMutation(user?.id);
    const confirmPaymentMutation = useConfirmPaymentReceivedMutation(user?.id);
    const requestLocationMutation = useRequestLiveLocationMutation(user?.id);
    const offerLocationMutation = useOfferLiveLocationMutation(user?.id);
    const respondLocationMutation = useRespondLiveLocationMutation(roomId);
    const updateLocationMutation = useUpdateLiveLocationMutation();
    const stopLocationMutation = useStopLiveLocationMutation(roomId);

    const isTasker = user?.id === taskerId;
    const isPoster = user?.id === posterId;
    const isChatLocked = taskStatus === 'completed';
    const otherUserId = isTasker ? posterId : taskerId;
    const isPaymentPending = taskStatus === 'payment_pending';
    const isPaymentSent = taskStatus === 'payment_sent';

    const fullTask = useMemo(
        () => tasks.find((t) => t.id === taskId),
        [tasks, taskId]
    );

    // ── Attachment menu animation ──
    useEffect(() => {
        Animated.timing(attachMenuAnim, {
            toValue: attachMenuVisible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [attachMenuVisible, attachMenuAnim]);

    // ── Mark messages as seen ──
    useEffect(() => {
        if (visible && user?.id && roomId) {
            markSeenMutation.mutate({ roomId, userId: user.id });
        }
    }, [visible, roomId, user?.id]);

    // ── Realtime: new messages ──
    useEffect(() => {
        if (!visible || !roomId) return;
        const channel = supabase
            .channel(`messages:${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `room_id=eq.${roomId}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(roomId) });
                if (user?.id) markSeenMutation.mutate({ roomId, userId: user.id });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [visible, roomId, user?.id]);

    // ── Realtime: task status changes ──
    useEffect(() => {
        if (!visible || !taskId || !user?.id) return;
        const channel = supabase
            .channel(`chat-task:${taskId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'tasks',
                filter: `id=eq.${taskId}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms(user!.id) });
                queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [visible, taskId, user?.id]);

    // ── Realtime: live location session changes ──
    useEffect(() => {
        if (!visible || !roomId) return;
        const channel = supabase
            .channel(`live-loc:${roomId}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'live_location_sessions',
                filter: `room_id=eq.${roomId}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: queryKeys.chat.liveLocation(roomId) });
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [visible, roomId]);

    // ── Sync live session state ──
    useEffect(() => {
        if (liveSession && liveSession.status === 'active') {
            setLiveMapSession(liveSession);
            setShowLiveMap(true);
        } else if (liveSession?.status === 'stopped' || liveSession?.status === 'expired' || liveSession?.status === 'denied') {
            setShowLiveMap(false);
            setLiveMapSession(null);
        }
    }, [liveSession]);

    // ── Clean up location watch on unmount ──
    useEffect(() => {
        return () => {
            if (locationWatchRef.current) {
                locationWatchRef.current.remove();
                locationWatchRef.current = null;
            }
        };
    }, []);

    // ── Start broadcasting location when we're the sharer ──
    useEffect(() => {
        if (!liveSession || liveSession.status !== 'active' || liveSession.sharer_id !== user?.id) {
            if (locationWatchRef.current) {
                locationWatchRef.current.remove();
                locationWatchRef.current = null;
            }
            return;
        }

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('Location permission is required to share your location.', 'warning');
                return;
            }

            locationWatchRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
                (loc) => {
                    updateLocationMutation.mutate({
                        sessionId: liveSession.id,
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    });
                }
            );
        })();

        return () => {
            if (locationWatchRef.current) {
                locationWatchRef.current.remove();
                locationWatchRef.current = null;
            }
        };
    }, [liveSession?.id, liveSession?.status, liveSession?.sharer_id, user?.id]);

    // ── Send text message ──
    const handleSend = useCallback(async () => {
        const trimmed = messageText.trim();
        if (!trimmed || !user?.id || isChatLocked) return;
        setMessageText('');
        try {
            await sendMutation.mutateAsync({ roomId, message: trimmed });
        } catch {
            setMessageText(trimmed);
        }
    }, [messageText, roomId, user?.id, sendMutation, isChatLocked]);

    // ── Pick & send photo ──
    const handlePickPhoto = useCallback(async () => {
        setAttachMenuVisible(false);
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showToast('Please allow access to your photos to send images.', 'warning');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.6, // Compress at pick time
                allowsEditing: false,
                base64: true, // Get base64 data directly
            });

            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];

            if (!asset.base64) {
                showToast('Could not read image data. Please try again.', 'error');
                return;
            }

            setUploadingImage(true);

            // Check size from base64 length (base64 is ~33% larger than binary)
            const estimatedSize = Math.ceil(asset.base64.length * 0.75);
            if (estimatedSize > MAX_IMAGE_SIZE) {
                showToast('Image exceeds the 10MB limit. Please choose a smaller one.', 'warning');
                setUploadingImage(false);
                return;
            }

            // Convert base64 → Uint8Array for Supabase Storage
            const byteChars = atob(asset.base64);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }

            // Upload to Supabase storage
            const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, byteArray, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) throw new Error(uploadError.message);

            const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(fileName);

            // Send as image message
            await sendMutation.mutateAsync({
                roomId,
                message: '📷 Photo',
                messageType: 'image',
                metadata: {
                    image_url: urlData.publicUrl,
                    width: asset.width,
                    height: asset.height,
                },
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to send photo. Please try again.', 'error');
        } finally {
            setUploadingImage(false);
        }
    }, [roomId, sendMutation]);

    // ── Share location (one-time, sending coords) ──
    const handleShareLocation = useCallback(async (forcedLocation?: {lat: number, lng: number}) => {
        setAttachMenuVisible(false);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('Location permission is required to share your location.', 'warning');
                return;
            }

            let coords = forcedLocation;
            if (!coords) {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
            }

            const [address] = await Location.reverseGeocodeAsync({
                latitude: coords.lat,
                longitude: coords.lng,
            });

            const addressStr = address
                ? [address.name, address.street, address.city, address.region].filter(Boolean).join(', ')
                : `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;

            await sendMutation.mutateAsync({
                roomId,
                message: `📍 ${addressStr}`,
                messageType: 'location_share',
                metadata: {
                    latitude: coords.lat,
                    longitude: coords.lng,
                    address: addressStr,
                },
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to share location.', 'error');
        }
    }, [roomId, sendMutation]);

    // ── Share location prompt (picker or current) ──
    const handleShareLocationPrompt = useCallback(() => {
        setAttachMenuVisible(false);

        // Always show the options dialog so user can choose
        setAlertConfig({
            visible: true,
            title: 'Share Location',
            message: 'How would you like to share your location?',
            variant: 'info',
            buttons: [
                { text: 'Current Location', style: 'default', onPress: () => handleShareLocation() },
                { text: 'Choose on Map', style: 'default', onPress: async () => {
                    if (!WebView) {
                        showToast('Map picker requires a full build. Sharing current location instead.', 'info');
                        handleShareLocation();
                        return;
                    }
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        try {
                            const loc = await Location.getLastKnownPositionAsync();
                            if (loc) {
                                setPickedLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                            } else {
                                setPickedLocation({ lat: 23.7271, lng: 92.7176 });
                            }
                        } catch (e) {
                            setPickedLocation({ lat: 23.7271, lng: 92.7176 });
                        }
                    } else {
                        setPickedLocation({ lat: 23.7271, lng: 92.7176 });
                    }
                    setMapPickerVisible(true);
                }},
                { text: 'Cancel', style: 'cancel' },
            ],
        });
    }, [handleShareLocation, showToast]);

    // ── Request live location ──
    const handleRequestLiveLocation = useCallback(async () => {
        setAttachMenuVisible(false);
        try {
            const result = await requestLocationMutation.mutateAsync({
                roomId,
                targetUserId: otherUserId,
            });

            // Send a system message about the request
            await sendMutation.mutateAsync({
                roomId,
                message: `📡 ${isTasker ? 'Tasker' : 'Poster'} is requesting your live location`,
                messageType: 'location_request',
                metadata: { session_id: result.session_id! },
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to request live location.', 'error');
        }
    }, [roomId, otherUserId, requestLocationMutation, sendMutation, isTasker]);

    // ── Offer live location ──
    const handleOfferLiveLocation = useCallback(async () => {
        setAttachMenuVisible(false);
        try {
            const result = await offerLocationMutation.mutateAsync({
                roomId,
                targetUserId: otherUserId,
            });

            // Send a system message about the offer
            await sendMutation.mutateAsync({
                roomId,
                message: `📡 ${isTasker ? 'Tasker' : 'Poster'} is offering to share their live location`,
                messageType: 'location_offer',
                metadata: { session_id: result.session_id! },
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to offer live location.', 'error');
        }
    }, [roomId, otherUserId, offerLocationMutation, sendMutation, isTasker]);


    // ── Respond to live location request ──
    const handleRespondToRequest = useCallback(async (sessionId: string, accept: boolean) => {
        try {
            await respondLocationMutation.mutateAsync({ sessionId, accept });

            await sendMutation.mutateAsync({
                roomId,
                message: accept
                    ? '✅ Live location sharing accepted'
                    : '❌ Live location request declined',
                messageType: 'location_response',
                metadata: { session_id: sessionId, status: accept ? 'accepted' : 'denied' },
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to respond.', 'error');
        }
    }, [roomId, respondLocationMutation, sendMutation]);

    // ── Stop live location ──
    const handleStopLiveLocation = useCallback(async () => {
        if (!liveSession) return;
        try {
            await stopLocationMutation.mutateAsync({ sessionId: liveSession.id });
            setShowLiveMap(false);
            setLiveMapSession(null);

            await sendMutation.mutateAsync({
                roomId,
                message: '⏹ Live location sharing stopped',
                messageType: 'system',
            });
        } catch (err: any) {
            showToast(err.message || 'Failed to stop.', 'error');
        }
    }, [liveSession, stopLocationMutation, sendMutation, roomId]);

    // ── Payment-driven completion handlers ──
    // Step 1: Tasker marks task as complete → sends payment_request system message into chat
    const handleFinishTask = useCallback(() => {
        setAlertConfig({
            visible: true,
            title: 'Mark as Complete',
            message: `Have you finished this task?\n\nThe poster will be asked to pay ₹${taskBudget} via UPI.`,
            variant: 'confirm',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Complete',
                    style: 'default',
                    onPress: async () => {
                        setCompletionLoading(true);
                        try {
                            const result = await finishMutation.mutateAsync({ taskId });
                            const upiId = result.tasker_upi_id || taskerUpiId || '';
                            const amount = result.amount ?? taskBudget ?? 0;
                            await sendMutation.mutateAsync({
                                roomId,
                                message: `💳 Payment Required — ₹${amount}`,
                                messageType: 'payment_request',
                                metadata: { upi_id: upiId, amount, task_title: taskTitle },
                            });
                            showToast('Task marked complete! Awaiting payment.', 'success');
                            if (user?.id) await queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms(user.id) });
                        } catch (err: any) {
                            showToast(err.message || 'Failed to mark complete', 'error');
                        } finally {
                            setCompletionLoading(false);
                        }
                    },
                },
            ],
        });
    }, [taskId, finishMutation, taskerUpiId, taskBudget, roomId, sendMutation, taskTitle, user?.id]);

    // Step 2b: Poster marks payment as sent (can be called directly or after UPI app)
    const handleMarkPaymentSent = useCallback(async () => {
        setCompletionLoading(true);
        try {
            await markPaymentSentMutation.mutateAsync({ taskId });
            await sendMutation.mutateAsync({
                roomId,
                message: '✅ Payment sent. Tasker, please confirm receipt.',
                messageType: 'system',
            });
            showToast('Payment marked as sent!', 'success');
            if (user?.id) await queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms(user.id) });
        } catch (err: any) {
            showToast(err.message || 'Failed to mark payment sent', 'error');
        } finally {
            setCompletionLoading(false);
        }
    }, [taskId, markPaymentSentMutation, sendMutation, roomId, user?.id]);

    // Step 2: Poster opens UPI app then confirms payment sent
    const handlePayNow = useCallback(() => {
        const upi = taskerUpiId;
        const amount = taskBudget;

        if (!upi) {
            showToast('Tasker has no UPI ID set. Contact them to pay manually.', 'warning');
            return;
        }

        setAlertConfig({
            visible: true,
            title: 'Pay via UPI',
            message: `Send ₹${amount} to:\n${upi}\n\nTap below to open your UPI app.`,
            variant: 'payment',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Open UPI App',
                    style: 'default',
                    onPress: async () => {
                        const upiUrl = `upi://pay?pa=${encodeURIComponent(upi)}&pn=Chhehchhawl&am=${amount}&cu=INR&tn=${encodeURIComponent(taskTitle)}`;
                        try {
                            const canOpen = await Linking.canOpenURL(upiUrl);
                            await Linking.openURL(canOpen ? upiUrl : 'https://pay.google.com/');
                        } catch {
                            showToast('Could not open UPI app. Please pay manually.', 'warning');
                            return;
                        }
                        // After returning from UPI, ask to confirm
                        setTimeout(() => {
                            setAlertConfig({
                                visible: true,
                                title: 'Payment Sent?',
                                message: 'Did you successfully send the payment?',
                                variant: 'confirm',
                                buttons: [
                                    { text: 'Not Yet', style: 'cancel' },
                                    { text: 'Yes, Mark Sent', style: 'default', onPress: () => handleMarkPaymentSent() },
                                ],
                            });
                        }, 2500);
                    },
                },
            ],
        });
    }, [taskerUpiId, taskBudget, taskTitle, handleMarkPaymentSent]);

    // Step 3: Tasker confirms payment received → task becomes completed → chat closes
    const handleConfirmPaymentReceived = useCallback(() => {
        setAlertConfig({
            visible: true,
            title: 'Confirm Payment Received',
            message: 'Have you received the payment? This will mark the task as Completed.',
            variant: 'confirm',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Received',
                    style: 'default',
                    onPress: async () => {
                        setCompletionLoading(true);
                        try {
                            await confirmPaymentMutation.mutateAsync({ taskId });
                            showToast('Task completed! 🎉', 'success');
                            if (user?.id) await queryClient.invalidateQueries({ queryKey: queryKeys.chat.rooms(user.id) });
                            setTimeout(() => onClose(), 1200);
                        } catch (err: any) {
                            showToast(err.message || 'Failed to confirm payment', 'error');
                        } finally {
                            setCompletionLoading(false);
                        }
                    },
                },
            ],
        });
    }, [taskId, confirmPaymentMutation, user?.id, onClose]);

    const invertedMessages = [...messages].reverse();

    // ── Keyboard handling (prevents jumpy layout in Modal) ──
    useEffect(() => {
        if (!visible) return;

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (e) => {
            const height = e?.endCoordinates?.height ?? 0;
            Animated.timing(composerTranslateY, {
                toValue: -height,
                duration: Platform.OS === 'ios' ? e.duration ?? 220 : 180,
                useNativeDriver: true,
            }).start();
        });

        const hideSub = Keyboard.addListener(hideEvent, (e) => {
            Animated.timing(composerTranslateY, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? e?.duration ?? 200 : 160,
                useNativeDriver: true,
            }).start();
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [visible, composerTranslateY]);

    // ── Render a single message ──
    const renderMessage = useCallback(
        ({ item }: { item: ChatMessage }) => {
            const isOwn = item.sender_id === user?.id;
            const type = item.message_type || 'text';

            // Payment request card — centered, special card UI
            if (type === 'payment_request') {
                const meta = item.metadata as { upi_id?: string; amount?: number; task_title?: string } | null;
                const upiId = meta?.upi_id || taskerUpiId || '—';
                const amount = meta?.amount ?? taskBudget ?? 0;
                return (
                    <View style={styles.systemMsgRow}>
                        <View style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: '#6C47FF' + '60' }]}>
                            <View style={styles.paymentCardHeader}>
                                <Ionicons name="wallet" size={18} color="#6C47FF" />
                                <Text style={[styles.paymentCardTitle, { color: '#6C47FF', fontFamily: FontFamily.bold }]}>Payment Required</Text>
                            </View>
                            <View style={styles.paymentCardRow}>
                                <Text style={[styles.paymentCardLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>Amount</Text>
                                <Text style={[styles.paymentCardValue, { color: colors.text, fontFamily: FontFamily.bold }]}>₹{amount}</Text>
                            </View>
                            <View style={styles.paymentCardRow}>
                                <Text style={[styles.paymentCardLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>UPI ID</Text>
                                <Text style={[styles.paymentCardValue, { color: colors.text, fontFamily: FontFamily.medium }]}>{upiId}</Text>
                            </View>
                            {isPoster && isPaymentPending && (
                                <Pressable
                                    style={[styles.paymentCardBtn, { backgroundColor: '#6C47FF' }]}
                                    onPress={handlePayNow}
                                >
                                    <Ionicons name="qr-code" size={14} color="#FFF" />
                                    <Text style={[styles.paymentCardBtnText, { fontFamily: FontFamily.bold }]}>Pay Now</Text>
                                </Pressable>
                            )}
                            <Text style={[styles.messageTime, { color: colors.textMuted, alignSelf: 'center', marginTop: 6 }]}>
                                {formatTime(item.created_at)}
                            </Text>
                        </View>
                    </View>
                );
            }

            // System messages — centered
            if (type === 'system' || type === 'location_request' || type === 'location_response' || type === 'location_offer') {
                return (
                    <View style={styles.systemMsgRow}>
                        <View style={[styles.systemMsgBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Text style={[styles.systemMsgText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                                {item.message}
                            </Text>
                            {/* Location request/offer accept/deny buttons */}
                            {(type === 'location_request' || type === 'location_offer') && !isOwn && liveSession?.status === 'pending' && (
                                <View style={styles.requestActionRow}>
                                    <TouchableOpacity
                                        style={[styles.requestBtn, { backgroundColor: BUBBLE_GREEN }]}
                                        onPress={() => {
                                            const meta = item.metadata as LiveLocationMetadata;
                                            if (meta?.session_id) handleRespondToRequest(meta.session_id, true);
                                        }}
                                    >
                                        <Ionicons name="checkmark" size={16} color="#FFF" />
                                        <Text style={styles.requestBtnText}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.requestBtn, { backgroundColor: colors.statusRed }]}
                                        onPress={() => {
                                            const meta = item.metadata as LiveLocationMetadata;
                                            if (meta?.session_id) handleRespondToRequest(meta.session_id, false);
                                        }}
                                    >
                                        <Ionicons name="close" size={16} color="#FFF" />
                                        <Text style={styles.requestBtnText}>Deny</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.systemMsgTime, { color: colors.textMuted }]}>
                            {formatTime(item.created_at)}
                        </Text>
                    </View>
                );
            }

            // Image message
            if (type === 'image') {
                const meta = item.metadata as ImageMessageMetadata | null;
                const imageUrl = meta?.image_url;
                const aspectRatio = meta?.width && meta?.height ? meta.width / meta.height : 4 / 3;
                const imgWidth = Math.min(SCREEN_WIDTH * 0.65, 280);
                const imgHeight = imgWidth / aspectRatio;

                return (
                    <View style={[styles.messageBubbleRow, isOwn ? styles.ownRow : styles.otherRow]}>
                        <View style={[
                            styles.imageBubble,
                            isOwn ? [styles.ownBubble, { backgroundColor: BUBBLE_BLUE }]
                                : [styles.otherBubble, { backgroundColor: BUBBLE_GREEN }],
                        ]}>
                            {imageUrl ? (
                                <Image
                                    source={{ uri: imageUrl }}
                                    style={[styles.chatImage, { width: imgWidth, height: imgHeight }]}
                                    resizeMode="cover"
                                    defaultSource={require('@/assets/images/icon.png')}
                                />
                            ) : (
                                <View style={[styles.chatImagePlaceholder, { width: imgWidth, height: imgHeight, backgroundColor: colors.border }]}>
                                    <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                                    <Text style={[styles.chatImageErrorText, { color: colors.textMuted }]}>Image unavailable</Text>
                                </View>
                            )}
                            <Text style={[styles.messageTime, { color: 'rgba(255,255,255,0.7)', alignSelf: 'flex-end', marginTop: 4, marginRight: 4 }]}>
                                {formatTime(item.created_at)}
                            </Text>
                        </View>
                    </View>
                );
            }

            // Location share message
            if (type === 'location_share') {
                const meta = item.metadata as LocationShareMetadata | null;
                const lat = meta?.latitude;
                const lng = meta?.longitude;
                const hasCoords = lat != null && lng != null;

                const openInMaps = () => {
                    if (!hasCoords) return;
                    // Google Maps web URL — works on all Android/iOS devices
                    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    Linking.openURL(url).catch(() => {
                        if (Platform.OS === 'android') {
                            Linking.openURL(`geo:${lat},${lng}?q=${lat},${lng}`);
                        }
                    });
                };

                const bubbleColor = isOwn ? BUBBLE_BLUE : BUBBLE_GREEN;

                return (
                    <View style={[styles.messageBubbleRow, isOwn ? styles.ownRow : styles.otherRow]}>
                        <TouchableOpacity
                            style={[styles.locationCard, isOwn ? styles.ownBubble : styles.otherBubble]}
                            activeOpacity={0.85}
                            onPress={openInMaps}
                        >
                            {/* Map thumbnail — WebView Leaflet (primary), OSM tile image (fallback) */}
                            {hasCoords ? (
                                <WebView
                                    style={styles.locationMapThumb}
                                    source={{ html: generateStaticMapHTML(lat!, lng!) }}
                                    scrollEnabled={false}
                                    javaScriptEnabled
                                    pointerEvents="none"
                                    renderError={() => (
                                        <OsmTileMapImage lat={lat!} lng={lng!} height={120} />
                                    )}
                                />
                            ) : (
                                <View style={[styles.locationMapThumb, styles.locationMapPlaceholder]}>
                                    <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.5)" />
                                </View>
                            )}

                            {/* Card body */}
                            <View style={[styles.locationCardBody, { backgroundColor: bubbleColor }]}>
                                <View style={styles.locationCardHeader}>
                                    <Ionicons name="location" size={16} color="#FFF" />
                                    <Text style={[styles.locationCardTitle, { fontFamily: FontFamily.bold }]}>Shared Location</Text>
                                </View>
                                {meta?.address ? (
                                    <Text style={[styles.locationCardAddress, { fontFamily: FontFamily.regular }]} numberOfLines={2}>
                                        {meta.address}
                                    </Text>
                                ) : hasCoords ? (
                                    <Text style={[styles.locationCardAddress, { fontFamily: FontFamily.regular }]}>
                                        {lat!.toFixed(5)}, {lng!.toFixed(5)}
                                    </Text>
                                ) : null}
                                <View style={styles.locationCardFooter}>
                                    <View style={styles.locationOpenRow}>
                                        <Ionicons name="navigate" size={12} color="rgba(255,255,255,0.9)" />
                                        <Text style={[styles.locationCardOpen, { fontFamily: FontFamily.semiBold }]}>Open in Google Maps</Text>
                                    </View>
                                    <Text style={[styles.messageTime, { color: 'rgba(255,255,255,0.65)' }]}>{formatTime(item.created_at)}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                );
            }

            // Default: text message — Blue (own), Green (other)
            return (
                <View style={[styles.messageBubbleRow, isOwn ? styles.ownRow : styles.otherRow]}>
                    <View style={[
                        styles.messageBubble,
                        isOwn ? [styles.ownBubble, { backgroundColor: BUBBLE_BLUE }]
                            : [styles.otherBubble, { backgroundColor: BUBBLE_GREEN }],
                    ]}>
                        <Text style={[styles.messageText, { color: '#FFFFFF', fontFamily: FontFamily.regular }]}>
                            {item.message}
                        </Text>
                        <Text style={[styles.messageTime, { color: 'rgba(255,255,255,0.6)', fontFamily: FontFamily.regular }]}>
                            {formatTime(item.created_at)}
                        </Text>
                    </View>
                </View>
            );
        },
        [user?.id, colors, liveSession, handleRespondToRequest, isPoster, isPaymentPending, handlePayNow, taskerUpiId, taskBudget]
    );

    // ── Status bar config ──
    const getStatusBarConfig = useCallback(() => {
        if (isChatLocked) return { label: 'Completed', color: colors.textMuted, icon: 'checkmark-circle' as const };
        if (taskStatus === 'payment_sent') return { label: 'Payment Sent', color: colors.statusGreen, icon: 'card' as const };
        if (taskStatus === 'payment_pending') return { label: 'Payment Pending', color: colors.statusOrange, icon: 'wallet' as const };
        if (taskStatus === 'pending_confirmation') return { label: 'Pending Confirmation', color: colors.statusOrange, icon: 'hourglass' as const };
        if (taskStatus === 'in-progress') return { label: 'In Progress', color: colors.statusOrange, icon: 'time' as const };
        if (taskStatus === 'assigned') return { label: 'Assigned', color: colors.statusGreen, icon: 'person' as const };
        return null;
    }, [taskStatus, isChatLocked, colors]);

    const statusBarConfig = getStatusBarConfig();

    // ── Completion action button (payment-driven flow) ──
    const renderCompletionAction = () => {
        if (isChatLocked) return null;

        // Step 1: Tasker can mark task as done (only when in-progress or assigned)
        if (isTasker && !taskerCompleted && (taskStatus === 'in-progress' || taskStatus === 'assigned')) {
            return (
                <Pressable style={[styles.completionButton, { backgroundColor: colors.statusGreen }]} onPress={handleFinishTask} disabled={completionLoading}>
                    {completionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                        <>
                            <Ionicons name="checkmark-done" size={16} color="#FFF" />
                            <Text style={[styles.completionButtonText, { fontFamily: FontFamily.bold }]}>Mark as Complete</Text>
                        </>
                    )}
                </Pressable>
            );
        }

        // Step 2 (Poster): Pay Now button when payment is pending
        if (isPoster && isPaymentPending) {
            return (
                <View style={styles.paymentActionRow}>
                    <Pressable
                        style={[styles.completionButton, { backgroundColor: '#6C47FF' }]}
                        onPress={handlePayNow}
                        disabled={completionLoading}
                    >
                        {completionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                            <>
                                <Ionicons name="qr-code" size={16} color="#FFF" />
                                <Text style={[styles.completionButtonText, { fontFamily: FontFamily.bold }]}>Pay Now</Text>
                            </>
                        )}
                    </Pressable>
                    <Pressable
                        style={[styles.paidButton, { borderColor: colors.statusGreen }]}
                        onPress={handleMarkPaymentSent}
                        disabled={completionLoading}
                    >
                        <Text style={[styles.paidButtonText, { color: colors.statusGreen, fontFamily: FontFamily.medium }]}>Already Paid</Text>
                    </Pressable>
                </View>
            );
        }

        // Step 2 (Tasker): Waiting for payment
        if (isTasker && isPaymentPending) {
            return (
                <View style={[styles.waitingBadge, { backgroundColor: colors.statusOrange + '15' }]}>
                    <Ionicons name="hourglass-outline" size={14} color={colors.statusOrange} />
                    <Text style={[styles.waitingText, { color: colors.statusOrange, fontFamily: FontFamily.medium }]}>Waiting for payment</Text>
                </View>
            );
        }

        // Step 3 (Tasker): Confirm payment received
        if (isTasker && isPaymentSent) {
            return (
                <Pressable
                    style={[styles.completionButton, { backgroundColor: colors.statusGreen }]}
                    onPress={handleConfirmPaymentReceived}
                    disabled={completionLoading}
                >
                    {completionLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                        <>
                            <Ionicons name="shield-checkmark" size={16} color="#FFF" />
                            <Text style={[styles.completionButtonText, { fontFamily: FontFamily.bold }]}>Confirm Payment Received</Text>
                        </>
                    )}
                </Pressable>
            );
        }

        // Step 3 (Poster): Waiting for tasker to confirm
        if (isPoster && isPaymentSent) {
            return (
                <View style={[styles.waitingBadge, { backgroundColor: colors.statusGreen + '15' }]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={colors.statusGreen} />
                    <Text style={[styles.waitingText, { color: colors.statusGreen, fontFamily: FontFamily.medium }]}>Payment sent — awaiting confirmation</Text>
                </View>
            );
        }

        return null;
    };

    // ── Attachment menu ──
    const attachMenuTranslateY = attachMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [120, 0] });
    const attachMenuOpacity = attachMenuAnim;

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top + Spacing.sm }]}>
                    <Pressable onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </Pressable>
                    <View style={styles.headerContent}>
                        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]} numberOfLines={1}>
                            {otherUserName ?? 'Chat'}
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textMuted, fontFamily: FontFamily.regular }]} numberOfLines={1}>
                            {taskTitle}
                        </Text>
                    </View>
                    {isTasker && (
                        <Pressable
                            onPress={() => setTaskerInfoVisible(true)}
                            style={[
                                styles.headerInfoButton,
                                { backgroundColor: colors.statusOrange + '20', borderRadius: 20, borderWidth: 1, borderColor: colors.statusOrange + '40' },
                            ]}
                        >
                            <Text style={[styles.infoExclamation, { color: colors.statusOrange }]}>!</Text>
                        </Pressable>
                    )}
                </View>

                {/* Status bar + completion action */}
                {(statusBarConfig || renderCompletionAction()) && (
                    <View style={[styles.statusBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                        {statusBarConfig && (
                            <View style={[styles.statusBadge, { backgroundColor: statusBarConfig.color + '15' }]}>
                                <Ionicons name={statusBarConfig.icon} size={14} color={statusBarConfig.color} />
                                <Text style={[styles.statusBadgeText, { color: statusBarConfig.color, fontFamily: FontFamily.medium }]}>
                                    {statusBarConfig.label}
                                </Text>
                            </View>
                        )}
                        {renderCompletionAction()}
                    </View>
                )}

                {/* Live location map (embedded, above messages when active) */}
                {showLiveMap && liveMapSession && (
                    <View style={[styles.liveMapContainer, { borderBottomColor: colors.border }]}>
                        <View style={styles.liveMapHeader}>
                            <View style={styles.liveIndicator}>
                                <View style={styles.liveDot} />
                                <Text style={[styles.liveText, { color: colors.statusGreen, fontFamily: FontFamily.bold }]}>LIVE</Text>
                            </View>
                            <Text style={[styles.liveLabel, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                {liveMapSession.sharer_id === user?.id ? 'You are sharing' : `${otherUserName} is sharing`}
                            </Text>
                            <TouchableOpacity style={[styles.liveStopBtn, { backgroundColor: colors.statusRed }]} onPress={handleStopLiveLocation}>
                                <Ionicons name="stop" size={12} color="#FFF" />
                                <Text style={[styles.liveStopText, { fontFamily: FontFamily.bold }]}>Stop</Text>
                            </TouchableOpacity>
                        </View>
                        {liveMapSession.latitude && liveMapSession.longitude ? (
                            <WebView
                                style={styles.liveMapWebview}
                                source={{
                                    html: generateMapHTML(liveMapSession.latitude, liveMapSession.longitude),
                                }}
                                scrollEnabled={false}
                                javaScriptEnabled
                                renderError={() => (
                                    <TouchableOpacity
                                        style={{ flex: 1, backgroundColor: '#f5f5f5' }}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            const url = `https://www.google.com/maps/search/?api=1&query=${liveMapSession.latitude},${liveMapSession.longitude}`;
                                            Linking.openURL(url);
                                        }}
                                    >
                                        <OsmTileMapImage
                                            lat={liveMapSession.latitude!}
                                            lng={liveMapSession.longitude!}
                                            height={170}
                                        />
                                        <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 }}>
                                            <Text style={{ color: '#FFF', fontSize: 12, fontFamily: FontFamily.bold }}>Open in Maps →</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        ) : (
                            <View style={[styles.liveMapPlaceholder, { backgroundColor: colors.card }]}>
                                <ActivityIndicator size="small" color={colors.accent} />
                                <Text style={[styles.liveMapWaiting, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                    Waiting for location data…
                                </Text>
                            </View>
                        )}
                    </View>
                )}


                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={invertedMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    inverted
                    contentContainerStyle={[
                        styles.messageList,
                        {
                            // Inverted FlatList: paddingTop becomes "bottom padding" visually.
                            paddingTop: Math.max(composerHeight, 56) + insets.bottom + Spacing.md,
                        },
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                />

                {/* Attachment menu overlay */}
                {attachMenuVisible && (
                    <Pressable style={styles.attachOverlay} onPress={() => setAttachMenuVisible(false)}>
                        <Animated.View style={[
                            styles.attachMenu,
                            { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ translateY: attachMenuTranslateY }], opacity: attachMenuOpacity },
                        ]}>
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handlePickPhoto}>
                                <View style={[styles.attachMenuIcon, { backgroundColor: '#4A90D9' }]}>
                                    <Ionicons name="image" size={22} color="#FFF" />
                                </View>
                                <Text style={[styles.attachMenuText, { color: colors.text, fontFamily: FontFamily.medium }]}>Photos</Text>
                            </TouchableOpacity>
                            {/* Static Location (Available to Both) */}
                            <TouchableOpacity style={styles.attachMenuItem} onPress={handleShareLocationPrompt}>
                                <View style={[styles.attachMenuIcon, { backgroundColor: BUBBLE_GREEN }]}>
                                    <Ionicons name="location" size={22} color="#FFF" />
                                </View>
                                <Text style={[styles.attachMenuText, { color: colors.text, fontFamily: FontFamily.medium }]}>Location</Text>
                            </TouchableOpacity>

                            {/* Request Live Location (Available ONLY to Poster) */}
                            {isPoster && (
                                <TouchableOpacity style={styles.attachMenuItem} onPress={handleRequestLiveLocation}>
                                    <View style={[styles.attachMenuIcon, { backgroundColor: colors.statusOrange }]}>
                                        <Ionicons name="navigate" size={22} color="#FFF" />
                                    </View>
                                    <Text style={[styles.attachMenuText, { color: colors.text, fontFamily: FontFamily.medium }]}>Live Location</Text>
                                </TouchableOpacity>
                            )}

                            {/* Offer Live Location (Available ONLY to Tasker) */}
                            {!isPoster && (
                                <TouchableOpacity style={styles.attachMenuItem} onPress={handleOfferLiveLocation}>
                                    <View style={[styles.attachMenuIcon, { backgroundColor: colors.statusOrange }]}>
                                        <Ionicons name="navigate" size={22} color="#FFF" />
                                    </View>
                                    <Text style={[styles.attachMenuText, { color: colors.text, fontFamily: FontFamily.medium }]}>Offer Tracking</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    </Pressable>
                )}

                {/* Input or locked banner */}
                {isChatLocked ? (
                    <Animated.View
                        style={[
                            styles.lockedBanner,
                            {
                                backgroundColor: colors.surface,
                                borderTopColor: colors.border,
                                paddingBottom: insets.bottom + Spacing.sm,
                                transform: [{ translateY: composerTranslateY }],
                            },
                        ]}
                        onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
                    >
                        <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                        <Text style={[styles.lockedText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                            This task has been completed
                        </Text>
                    </Animated.View>
                ) : (
                    <Animated.View
                        style={[
                            styles.inputRow,
                            {
                                backgroundColor: colors.surface,
                                borderTopColor: colors.border,
                                paddingBottom: insets.bottom + Spacing.sm,
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                transform: [{ translateY: composerTranslateY }],
                            },
                        ]}
                        onLayout={(e) => setComposerHeight(e.nativeEvent.layout.height)}
                    >
                        {/* + Attach button */}
                        <Pressable
                            style={[styles.attachButton, { backgroundColor: attachMenuVisible ? colors.accent : colors.card }]}
                            onPress={() => setAttachMenuVisible(!attachMenuVisible)}
                        >
                            {uploadingImage ? (
                                <ActivityIndicator size="small" color={colors.accent} />
                            ) : (
                                <Ionicons name={attachMenuVisible ? 'close' : 'add'} size={22} color={attachMenuVisible ? '#FFF' : colors.text} />
                            )}
                        </Pressable>
                        <TextInput
                            style={[styles.textInput, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.border, fontFamily: FontFamily.regular }]}
                            placeholder="Type a message..."
                            placeholderTextColor={colors.textMuted}
                            value={messageText}
                            onChangeText={setMessageText}
                            multiline
                            maxLength={2000}
                        />
                        <Pressable
                            style={[styles.sendButton, { backgroundColor: messageText.trim() ? colors.accent : colors.card }]}
                            onPress={handleSend}
                            disabled={!messageText.trim() || sendMutation.isPending}
                        >
                            <Ionicons name="send" size={20} color={messageText.trim() ? '#FFFFFF' : colors.textMuted} />
                        </Pressable>
                    </Animated.View>
                )}
            </View>

            {/* Task Detail Sheet (poster view) */}
            {fullTask && taskDetailVisible && (
                <TaskDetailSheet task={fullTask} visible={taskDetailVisible} onClose={() => setTaskDetailVisible(false)} />
            )}

            {/* Tasker Info Modal */}
            <TaskerInfoModal
                visible={taskerInfoVisible}
                onClose={() => setTaskerInfoVisible(false)}
                task={fullTask ?? null}
                taskTitle={taskTitle}
                colors={colors}
                insets={insets}
            />
            {/* Map Picker Modal */}
            <Modal visible={mapPickerVisible} transparent={false} animationType="slide" onRequestClose={() => setMapPickerVisible(false)}>
                <View style={styles.pickerModalContainer}>
                    <View style={[styles.pickerModalHeader, { paddingTop: insets.top || Spacing.md }]}>
                        <TouchableOpacity onPress={() => setMapPickerVisible(false)}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={[styles.pickerModalTitle, { fontFamily: FontFamily.bold }]}>Pick Location</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    {WebView && pickedLocation ? (
                        <View style={{ flex: 1 }}>
                            <WebView
                                source={{ html: generatePickerMapHTML(pickedLocation.lat, pickedLocation.lng) }}
                                style={{ flex: 1 }}
                                onMessage={(event: any) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'location_changed') {
                                            setPickedLocation({ lat: data.lat, lng: data.lng });
                                        }
                                    } catch (e) {}
                                }}
                            />
                            <TouchableOpacity
                                style={[styles.pickerConfirmBtn, { backgroundColor: colors.accent }]}
                                onPress={async () => {
                                    setMapPickerVisible(false);
                                    await handleShareLocation(pickedLocation);
                                }}
                            >
                                <Text style={{ color: '#FFF', fontFamily: FontFamily.bold, fontSize: 16 }}>Confirm Selection</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text style={{ marginTop: 16, color: '#666' }}>Loading map...</Text>
                        </View>
                    )}
                </View>
            </Modal>

            {/* Map picker Modal */}
            {/* (above already closes map modal) */}

            {/* Themed custom alert — rendered as independent Modal, so it overlays everything */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                variant={alertConfig.variant}
                buttons={alertConfig.buttons}
                onDismiss={closeAlert}
            />
        </Modal>
    );
}

// ── Helpers ──

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Generate a small static Leaflet map for one-time location share cards. */
function generateStaticMapHTML(lat: number, lng: number): string {
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}*{pointer-events:none!important}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false}).setView([${lat},${lng}],15);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
L.marker([${lat},${lng}]).addTo(map);
</script>
</body></html>`;
}

/** Generate a minimal B&W Leaflet map for the live location WebView. */
function generateMapHTML(lat: number, lng: number): string {
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],16);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
var marker=L.circleMarker([${lat},${lng}],{radius:10,fillColor:'#2B6CB0',color:'#fff',weight:3,fillOpacity:1}).addTo(map);
marker.bindPopup('<b>Live Location</b>').openPopup();
</script>
</body></html>`;
}

/** Generate a Map Picker for choosing a location */
function generatePickerMapHTML(lat: number, lng: number): string {
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#map{margin:0;padding:0;width:100%;height:100%}
.center-marker{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);z-index:9999;
  font-size:40px;pointer-events:none;text-shadow:0px 2px 4px rgba(0,0,0,0.5);
}
</style>
</head><body>
<div id="map"></div>
<div class="center-marker">📍</div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],16);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
map.on('moveend',function(){
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location_changed', lat: center.lat, lng: center.lng }));
});
</script>
</body></html>`;
}

// ── Styles ──

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    pickerModalContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    pickerModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        paddingTop: Platform.OS === 'ios' ? 50 : Spacing.md,
        backgroundColor: '#FFF',
    },
    pickerModalTitle: {
        fontSize: 18,
    },
    pickerConfirmBtn: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        padding: Spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerContent: { flex: 1, marginLeft: Spacing.sm },
    headerTitle: { fontSize: FontSize.lg },
    headerSubtitle: { fontSize: FontSize.xs, marginTop: 2 },
    headerInfoButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    infoExclamation: { fontSize: 20, fontFamily: FontFamily.bold, lineHeight: 24 },
    statusBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, gap: Spacing.sm,
    },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.sm + 2, paddingVertical: 4, borderRadius: BorderRadius.md, gap: 4,
    },
    statusBadgeText: { fontSize: FontSize.xs },
    completionButton: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: 6,
    },
    completionButtonText: { fontSize: FontSize.sm, color: '#FFFFFF' },
    waitingBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.sm + 2, paddingVertical: 4, borderRadius: BorderRadius.md, gap: 4,
    },
    waitingText: { fontSize: FontSize.xs },
    lockedBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, gap: Spacing.sm,
    },
    lockedText: { fontSize: FontSize.sm },
    messageList: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
    messageBubbleRow: { marginBottom: Spacing.sm, flexDirection: 'row' },
    ownRow: { justifyContent: 'flex-end' },
    otherRow: { justifyContent: 'flex-start' },
    messageBubble: {
        maxWidth: '78%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.lg,
    },
    ownBubble: { borderBottomRightRadius: 4 },
    otherBubble: { borderBottomLeftRadius: 4 },
    messageText: { fontSize: FontSize.md, lineHeight: 22 },
    messageTime: { fontSize: FontSize.xs - 1, marginTop: 4, alignSelf: 'flex-end' },

    // Image messages
    imageBubble: {
        maxWidth: '78%', borderRadius: BorderRadius.lg, overflow: 'hidden', padding: 3,
    },
    chatImage: { borderRadius: BorderRadius.md },
    chatImagePlaceholder: {
        borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', gap: 6,
    },
    chatImageErrorText: { fontSize: FontSize.xs },

    // Location messages — enhanced card with map thumbnail
    locationCard: {
        maxWidth: '78%', minWidth: 220, borderRadius: BorderRadius.lg, overflow: 'hidden',
    },
    locationMapThumb: { height: 120, width: '100%', backgroundColor: '#c8e0c8' },
    locationMapPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    locationCardBody: { padding: Spacing.md },
    locationCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    locationCardTitle: { color: '#FFF', fontSize: FontSize.sm },
    locationCardAddress: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, lineHeight: 18, marginBottom: 6 },
    locationCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
    locationOpenRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    locationCardOpen: { color: 'rgba(255,255,255,0.95)', fontSize: FontSize.xs },

    // System messages
    systemMsgRow: { alignItems: 'center', marginBottom: Spacing.md },
    systemMsgBubble: {
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg, borderWidth: 1, maxWidth: '85%',
    },
    systemMsgText: { fontSize: FontSize.sm, textAlign: 'center' },
    systemMsgTime: { fontSize: FontSize.xs - 2, marginTop: 2 },
    requestActionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, justifyContent: 'center' },
    requestBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.md,
    },
    requestBtnText: { color: '#FFF', fontSize: FontSize.sm, fontFamily: FontFamily.bold },

    // Live map
    liveMapContainer: { borderBottomWidth: 1, overflow: 'hidden' },
    liveMapHeader: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm, gap: Spacing.sm,
    },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50' },
    liveText: { fontSize: FontSize.xs },
    liveLabel: { flex: 1, fontSize: FontSize.xs },
    liveStopBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        paddingHorizontal: Spacing.sm + 2, paddingVertical: 4, borderRadius: BorderRadius.md,
    },
    liveStopText: { color: '#FFF', fontSize: FontSize.xs },
    liveMapWebview: { height: 180, width: '100%' },
    liveMapPlaceholder: { height: 180, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
    liveMapWaiting: { fontSize: FontSize.sm },
    liveMapFallback: { height: 180, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
    liveMapFallbackCoords: { fontSize: FontSize.md },
    liveMapFallbackLink: { fontSize: FontSize.sm },

    // Input row + attach
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, gap: Spacing.sm,
    },
    attachButton: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
    },
    textInput: {
        flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1,
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.md, maxHeight: 100,
    },
    sendButton: {
        width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    },

    // Payment action row (Pay Now + Already Paid)
    paymentActionRow: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    },
    paidButton: {
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1,
    },
    paidButtonText: {
        fontSize: FontSize.sm,
    },

    // Payment card in chat
    paymentCard: {
        borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.md, minWidth: 240, maxWidth: '88%',
        gap: Spacing.xs,
    },
    paymentCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
    paymentCardTitle: { fontSize: FontSize.md },
    paymentCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
    paymentCardLabel: { fontSize: FontSize.sm },
    paymentCardValue: { fontSize: FontSize.sm },
    paymentCardBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    },
    paymentCardBtnText: { color: '#FFF', fontSize: FontSize.sm },

    // Attachment menu
    attachOverlay: {
        ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end',
    },
    attachMenu: {
        marginHorizontal: Spacing.md, marginBottom: 100,
        borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md,
        flexDirection: 'row', justifyContent: 'space-around',
    },
    attachMenuItem: { alignItems: 'center', gap: 6 },
    attachMenuIcon: {
        width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    },
    attachMenuText: { fontSize: FontSize.xs },
});

// ── TaskerInfoModal ─────────────────────────────────────────────

interface TaskerInfoModalProps {
    visible: boolean;
    onClose: () => void;
    task: Task | null;
    taskTitle: string;
    colors: any;
    insets: { top: number; bottom: number };
}

function TaskerInfoModal({ visible, onClose, task, taskTitle, colors, insets }: TaskerInfoModalProps) {
    const { showToast } = useToast();
    const handleOpenMaps = useCallback(() => {
        if (!task) return;
        if (task.latitude != null && task.longitude != null) {
            const url = Platform.select({
                ios: `maps://?daddr=${task.latitude},${task.longitude}`,
                android: `geo:${task.latitude},${task.longitude}?q=${task.latitude},${task.longitude}(${encodeURIComponent(task.title)})`,
            });
            if (url) {
                Linking.canOpenURL(url).then((supported) => {
                    const fallback = `https://www.google.com/maps/search/?api=1&query=${task.latitude},${task.longitude}`;
                    Linking.openURL(supported ? url : fallback);
                });
            }
        } else if (task.location) {
            const q = encodeURIComponent(task.location);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
        } else {
            showToast('This task does not have a location set.', 'info');
        }
    }, [task]);

    if (!visible) return null;

    const hasCoords = task && task.latitude != null && task.longitude != null;
    const hasLocation = task && (task.location || hasCoords);

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <View style={tiStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[tiStyles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.md }]}>
                    <View style={tiStyles.handleArea}>
                        <View style={[tiStyles.handle, { backgroundColor: colors.textMuted + '60' }]} />
                    </View>
                    <View style={[tiStyles.header, { borderBottomColor: colors.border }]}>
                        <View style={[tiStyles.headerBadge, { backgroundColor: colors.statusOrange + '18' }]}>
                            <Text style={[tiStyles.headerExclamation, { color: colors.statusOrange }]}>!</Text>
                        </View>
                        <Text style={[tiStyles.headerTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>Task Details</Text>
                        <TouchableOpacity onPress={onClose} style={tiStyles.closeBtn}>
                            <Ionicons name="close" size={22} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={tiStyles.body} showsVerticalScrollIndicator={false}>
                        <Text style={[tiStyles.taskTitle, { color: colors.text, fontFamily: FontFamily.bold }]}>
                            {task?.title ?? taskTitle}
                        </Text>
                        {task?.description ? (
                            <View style={[tiStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={tiStyles.sectionHeader}>
                                    <Ionicons name="document-text-outline" size={15} color={colors.accent} />
                                    <Text style={[tiStyles.sectionLabel, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>Description</Text>
                                </View>
                                <Text style={[tiStyles.sectionContent, { color: colors.text, fontFamily: FontFamily.regular }]}>{task.description}</Text>
                            </View>
                        ) : null}
                        {task?.extra_description ? (
                            <View style={[tiStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <View style={tiStyles.sectionHeader}>
                                    <Ionicons name="information-circle-outline" size={15} color={colors.accent} />
                                    <Text style={[tiStyles.sectionLabel, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>Additional Instructions</Text>
                                </View>
                                <Text style={[tiStyles.sectionContent, { color: colors.text, fontFamily: FontFamily.regular }]}>{task.extra_description}</Text>
                            </View>
                        ) : null}
                        {/* Location section */}
                        <View style={[tiStyles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={tiStyles.sectionHeader}>
                                <Ionicons name="location-outline" size={15} color={hasLocation ? colors.accent : colors.textMuted} />
                                <Text style={[tiStyles.sectionLabel, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>Location</Text>
                            </View>

                            {hasLocation ? (

                                <>
                                    {/* Map thumbnail — tappable to open Google Maps */}
                                    {hasCoords ? (
                                        <TouchableOpacity
                                            style={tiStyles.mapThumbWrapper}
                                            onPress={handleOpenMaps}
                                            activeOpacity={0.85}
                                        >
                                            <OsmTileMapImage lat={task!.latitude!} lng={task!.longitude!} height={160} />
                                            {/* "Open in Maps" pill overlay */}
                                            <View style={tiStyles.mapOpenPill}>
                                                <Ionicons name="navigate" size={12} color="#FFF" />
                                                <Text style={tiStyles.mapOpenPillText}>Open in Google Maps</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ) : null}

                                    {/* Full address text */}
                                    {task!.location ? (
                                        <Text style={[tiStyles.locationAddress, { color: colors.text, fontFamily: FontFamily.medium }]}>
                                            {task!.location}
                                        </Text>
                                    ) : null}

                                    {/* Locality / neighbourhood */}
                                    {task!.locality ? (
                                        <View style={tiStyles.locationRow}>
                                            <Ionicons name="business-outline" size={13} color={colors.textMuted} />
                                            <Text style={[tiStyles.locationMeta, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                                {task!.locality}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* District */}
                                    {task!.district ? (
                                        <View style={tiStyles.locationRow}>
                                            <Ionicons name="map-outline" size={13} color={colors.textMuted} />
                                            <Text style={[tiStyles.locationMeta, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                                {task!.district} District
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* State */}
                                    {task!.state ? (
                                        <View style={tiStyles.locationRow}>
                                            <Ionicons name="flag-outline" size={13} color={colors.textMuted} />
                                            <Text style={[tiStyles.locationMeta, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                                {task!.state}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Coordinates */}
                                    {hasCoords ? (
                                        <View style={tiStyles.locationRow}>
                                            <Ionicons name="compass-outline" size={13} color={colors.textMuted} />
                                            <Text style={[tiStyles.locationMeta, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                                {task!.latitude!.toFixed(5)}, {task!.longitude!.toFixed(5)}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Directions button */}
                                    <TouchableOpacity
                                        style={[tiStyles.mapsButton, { backgroundColor: colors.accent }]}
                                        onPress={handleOpenMaps}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="navigate" size={16} color="#FFF" />
                                        <Text style={[tiStyles.mapsButtonText, { fontFamily: FontFamily.bold }]}>Get Directions</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <Text style={[tiStyles.sectionContent, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>
                                    No location provided
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const tiStyles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: { borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, maxHeight: '90%', overflow: 'hidden' },
    handleArea: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
    handle: { width: 36, height: 4, borderRadius: 2 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm,
    },
    headerBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    headerExclamation: { fontSize: 18, fontFamily: FontFamily.bold },
    headerTitle: { flex: 1, fontSize: FontSize.lg },
    closeBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
    taskTitle: { fontSize: FontSize.xl, marginBottom: Spacing.md, lineHeight: 28 },
    section: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    sectionLabel: { fontSize: FontSize.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionContent: { fontSize: FontSize.md, lineHeight: 22 },
    // Map thumbnail
    mapThumbWrapper: {
        borderRadius: BorderRadius.md, overflow: 'hidden',
        marginBottom: Spacing.sm,
    },
    mapOpenPill: {
        position: 'absolute', bottom: 8, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
    },
    mapOpenPillText: { color: '#FFF', fontSize: 12, fontFamily: FontFamily.bold },
    // Location detail rows
    locationAddress: { fontSize: FontSize.md, lineHeight: 22, marginBottom: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
    locationMeta: { fontSize: FontSize.sm, lineHeight: 18 },
    // Directions button
    mapsButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: Spacing.md, paddingVertical: Spacing.sm + 2, borderRadius: BorderRadius.md,
    },
    mapsButtonText: { color: '#FFFFFF', fontSize: FontSize.sm },
});
