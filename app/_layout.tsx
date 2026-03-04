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
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ApplicationProvider } from '@/contexts/ApplicationContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TaskProvider } from '@/contexts/TaskContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isAuthenticated, isProfileComplete, isLoading } = useAuth();
  const { isDark, colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // ── Secure routing: redirect based on auth state ──
  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuth = firstSegment === 'login' || firstSegment === 'phone-auth';
    const inProfile = firstSegment === 'complete-profile';

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
      // Fully authenticated → must be in (tabs) or create-task
      if (inAuth || inProfile) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isProfileComplete, isLoading, segments]);

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
          animation: 'fade_from_bottom',
        }}
      >
        {/* Auth screens */}
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="phone-auth" options={{ animation: 'slide_from_right' }} />
        {/* Profile completion */}
        <Stack.Screen name="complete-profile" options={{ animation: 'fade' }} />
        {/* Main app */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-task" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        translucent={false}
        backgroundColor={colors.background}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'SpaceGrotesk-Light': require('@/assets/fonts/SpaceGrotesk-Light.ttf'),
    'SpaceGrotesk-Regular': require('@/assets/fonts/SpaceGrotesk-Regular.ttf'),
    'SpaceGrotesk-Medium': require('@/assets/fonts/SpaceGrotesk-Medium.ttf'),
    'SpaceGrotesk-SemiBold': require('@/assets/fonts/SpaceGrotesk-SemiBold.ttf'),
    'SpaceGrotesk-Bold': require('@/assets/fonts/SpaceGrotesk-Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TaskProvider>
              <ApplicationProvider>
                <RootNavigator />
              </ApplicationProvider>
            </TaskProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
