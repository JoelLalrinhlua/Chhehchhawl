/**
 * supabase.ts — Initialises and exports the shared Supabase client.
 *
 * Auth tokens are persisted to AsyncStorage so sessions survive app restarts.
 * An AppState listener toggles the auto-refresh timer so expired JWTs are
 * silently renewed whenever the app returns to the foreground.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Singleton Supabase client used throughout the application. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Keep session alive when app is in the foreground
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
