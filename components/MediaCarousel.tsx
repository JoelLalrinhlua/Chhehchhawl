/**
 * MediaCarousel.tsx — Horizontal paginated image/video carousel.
 *
 * Used inside TaskDetailSheet and create-task preview to display task media.
 * Images are rendered with `expo-image`; tapping a video opens the device’s
 * default player via `Linking`. Includes dot-style pagination indicators.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    Linking,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const CAROUSEL_HEIGHT = 220;

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

function isVideoUrl(url: string): boolean {
    const lower = url.toLowerCase().split('?')[0];
    return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface MediaCarouselProps {
    mediaUrls: string[];
}

export function MediaCarousel({ mediaUrls }: MediaCarouselProps) {
    const { colors } = useTheme();
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollRef = useRef<ScrollView>(null);

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / CAROUSEL_WIDTH);
            setActiveIndex(index);
        },
        []
    );

    if (!mediaUrls || mediaUrls.length === 0) return null;

    const handleVideoPress = (url: string) => {
        Linking.openURL(url).catch(() => {});
    };

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                snapToInterval={CAROUSEL_WIDTH}
                decelerationRate="fast"
                contentContainerStyle={styles.scrollContent}
            >
                {mediaUrls.map((url, index) => {
                    const isVideo = isVideoUrl(url);
                    return (
                        <View key={`${url}-${index}`} style={styles.itemContainer}>
                            {isVideo ? (
                                <Pressable
                                    style={[styles.videoContainer, { backgroundColor: colors.card }]}
                                    onPress={() => handleVideoPress(url)}
                                >
                                    <View style={styles.videoOverlay}>
                                        <View style={[styles.playButton, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                                            <Ionicons name="play" size={32} color="#FFFFFF" />
                                        </View>
                                        <Text style={[styles.videoLabel, { color: '#FFFFFF', fontFamily: FontFamily.medium }]}>
                                            Tap to play video
                                        </Text>
                                    </View>
                                </Pressable>
                            ) : (
                                <Image
                                    source={{ uri: url }}
                                    style={[styles.image, { backgroundColor: colors.card }]}
                                    contentFit="cover"
                                    recyclingKey={url}
                                    transition={200}
                                />
                            )}
                        </View>
                    );
                })}
            </ScrollView>
            {mediaUrls.length > 1 && (
                <View style={styles.dotsContainer}>
                    {mediaUrls.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor:
                                        index === activeIndex
                                            ? colors.accent
                                            : colors.textMuted + '50',
                                    width: index === activeIndex ? 18 : 7,
                                },
                            ]}
                        />
                    ))}
                </View>
            )}
            {mediaUrls.length > 1 && (
                <Text style={[styles.counter, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                    {activeIndex + 1}/{mediaUrls.length}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    scrollContent: {
        // no extra padding — items snap edge-to-edge
    },
    itemContainer: {
        width: CAROUSEL_WIDTH,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    image: {
        width: CAROUSEL_WIDTH,
        height: CAROUSEL_HEIGHT,
        borderRadius: BorderRadius.md,
    },
    videoContainer: {
        width: CAROUSEL_WIDTH,
        height: CAROUSEL_HEIGHT,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 4,
    },
    videoLabel: {
        fontSize: FontSize.sm,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing.sm,
        gap: 6,
    },
    dot: {
        height: 7,
        borderRadius: 3.5,
    },
    counter: {
        textAlign: 'center',
        fontSize: FontSize.xs,
        marginTop: Spacing.xs,
    },
});
