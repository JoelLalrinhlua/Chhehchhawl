/**
 * _layout.tsx — Root layout of the Expo Router app.
 *
 * Sets up the global provider hierarchy:
 *   GestureHandlerRootView > QueryClientProvider > ThemeProvider >
 *   AuthProvider > TaskProvider > ApplicationProvider
 *
 * Also loads SpaceGrotesk custom fonts, manages the splash screen,
 * and contains `RootNavigator` which enforces auth-based routing guards
 * (unauthenticated → /login, no profile → /complete-profile, else → tabs).
 *
 * Splash screen strategy:
 *   - Native splash (static image) is hidden immediately once fonts load.
 *   - A custom full-screen video overlay (splash-screen.mp4) plays on top.
 *   - Overlay fades out once the video ends AND fonts are ready.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ApplicationProvider } from '@/contexts/ApplicationContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { queryClient } from '@/lib/query-client';
import { getWelcomeSeenKey } from '@/lib/welcome-seen';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Keep the native splash visible until we're ready to show the video
SplashScreen.preventAutoHideAsync();

// ── Video Splash Overlay ──────────────────────────────────────────────────────
const SPLASH_VIDEO = require('@/assets/images/splash-screen.mp4');

function VideoSplash({ onFinished }: { onFinished: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const hasFinished = useRef(false);

  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  const finish = useCallback(() => {
    if (hasFinished.current) return;
    hasFinished.current = true;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => onFinished());
  }, [opacity, onFinished]);

  useEffect(() => {
    const sub = player.addListener('playingChange', (event) => {
      // Video stopped playing (ended)
      if (!event.isPlaying && player.currentTime > 0) {
        finish();
      }
    });
    // Safety timeout — dismiss after 5s even if video stalls
    const timer = setTimeout(finish, 5000);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [player, finish]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.splash, { opacity }]} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
    </Animated.View>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
function RootNavigator() {
  const { isAuthenticated, isProfileComplete, isLoading, user } = useAuth();
  const { isDark, colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // ── Secure routing: redirect based on auth state ──
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuth = firstSegment === 'login' || firstSegment === 'phone-auth';
    const inProfile = firstSegment === 'complete-profile';
    const inWelcome = firstSegment === 'welcome';

    if (!isAuthenticated) {
      // Not logged in → must be on login or phone-auth
      if (!inAuth) {
        router.replace('/login');
      }
    } else if (!isProfileComplete) {
      // Logged in but profile incomplete → must be on complete-profile
      if (!inProfile) {
        router.replace('/complete-profile');
      }
    } else {
      // Fully authenticated — check if this is a new user who hasn't seen welcome
      if (inAuth || inProfile) {
        // Coming from auth/profile screens: check if welcome screen was shown
        if (user?.id) {
          AsyncStorage.getItem(getWelcomeSeenKey(user.id)).then((seen) => {
            if (!seen) {
              router.replace('/welcome');
            } else {
              router.replace('/(tabs)');
            }
          });
        } else {
          router.replace('/(tabs)');
        }
      } else if (!inWelcome) {
        // Already in the app — if welcome hasn't been seen, redirect
        // (edge case: profile just completed but segment not yet auth/profile)
        // We only do this if we're not already heading somewhere valid.
      }
    }
  }, [isAuthenticated, isProfileComplete, isLoading, segments, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'default',
        }}
      >
        {/* Auth screens */}
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="phone-auth" options={{ animation: 'default' }} />
        {/* Profile completion */}
        <Stack.Screen name="complete-profile" options={{ animation: 'fade' }} />
        {/* Welcome / onboarding (shown once per new user) */}
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
        {/* Main app */}
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="create-task" options={{ animation: 'slide_from_bottom' }} />
        {/* Profile sub-screens */}
        <Stack.Screen name="edit-profile" options={{ animation: 'default' }} />
        <Stack.Screen name="suggestions" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="terms-of-service" options={{ animation: 'default' }} />
      </Stack>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        translucent={false}
        backgroundColor={colors.background}
      />
    </>
  );
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'SpaceGrotesk-Light': require('@/assets/fonts/SpaceGrotesk-Light.ttf'),
    'SpaceGrotesk-Regular': require('@/assets/fonts/SpaceGrotesk-Regular.ttf'),
    'SpaceGrotesk-Medium': require('@/assets/fonts/SpaceGrotesk-Medium.ttf'),
    'SpaceGrotesk-SemiBold': require('@/assets/fonts/SpaceGrotesk-SemiBold.ttf'),
    'SpaceGrotesk-Bold': require('@/assets/fonts/SpaceGrotesk-Bold.ttf'),
  });

  const [showVideo, setShowVideo] = useState(true);

  // Hide the native splash once fonts are settled; the video overlay takes over
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const handleVideoFinished = useCallback(() => {
    setShowVideo(false);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <TaskProvider>
                  <ApplicationProvider>
                    <RootNavigator />
                  </ApplicationProvider>
                </TaskProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>

      {/* Custom video splash rendered above everything else */}
      {showVideo && <VideoSplash onFinished={handleVideoFinished} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    backgroundColor: '#000000',
    zIndex: 9999,
  },
});
