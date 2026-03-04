/**
 * AuthContext.tsx — Central authentication & user-profile provider.
 *
 * Responsibilities:
 *  - Manages Supabase session lifecycle (init, listen, sign-out)
 *  - Exposes sign-up / sign-in methods (email, Google OAuth, phone OTP)
 *  - Fetches & caches the user profile via TanStack Query
 *  - Provides `isAuthenticated` / `isProfileComplete` flags used for routing guards
 *
 * Consumed by almost every screen via the `useAuth()` hook.
 */

import { useUpdateProfileMutation } from '@/hooks/use-mutations';
import { useProfileQuery } from '@/hooks/use-profile-queries';
import { queryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

WebBrowser.maybeCompleteAuthSession();

/** Shape of the `profiles` table row in Supabase. */
export type Profile = {
    id: string;
    full_name: string | null;
    username: string | null;
    phone: string | null;
    date_of_birth: string | null;
    avatar_url: string | null;
    location: string | null;
    bio: string | null;
    home_latitude: number | null;
    home_longitude: number | null;
    state: string | null;
    district: string | null;
    profile_completed: boolean;
    created_at: string;
    updated_at: string;
};

/** Read-only auth state exposed to consumers. */
type AuthState = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isProfileComplete: boolean;
};

/** Callable auth actions (sign-in, sign-out, profile update, etc.). */
type AuthActions = {
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signInWithGoogle: () => Promise<{ error: string | null }>;
    signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
    verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
    sendPhoneVerification: (phone: string) => Promise<{ error: string | null; otpPreview?: string }>;
    verifyPhoneCode: (phone: string, token: string) => Promise<{ error: string | null }>;
    updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Root auth provider — wrap around the entire app.
 *
 * On mount it restores the Supabase session from AsyncStorage, validates it
 * server-side, and subscribes to `onAuthStateChange` for live updates.
 * Profile data is fetched via TanStack Query and kept fresh automatically.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const userId = session?.user?.id;

    // Use TanStack Query for profile fetching with caching & background refetch
    const {
        data: profile = null,
        isLoading: profileLoading,
    } = useProfileQuery(userId);

    // Profile update mutation via TanStack Query
    const updateProfileMutation = useUpdateProfileMutation(userId);

    // Refresh profile by invalidating the query
    const refreshProfile = useCallback(async () => {
        if (userId) {
            await queryClient.invalidateQueries({
                queryKey: queryKeys.auth.profile(userId),
            });
        }
    }, [userId]);

    // Initialize session & listen for changes
    useEffect(() => {
        const initSession = async () => {
            setIsLoading(true);
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            // Validate the user still exists server-side (getSession only reads local cache)
            if (currentSession) {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    if (__DEV__) console.warn('[Auth] Stale session detected — user no longer exists. Signing out.');
                    await supabase.auth.signOut();
                    setSession(null);
                    setIsLoading(false);
                    return;
                }
            }

            setSession(currentSession);
            setIsLoading(false);
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, newSession) => {
                setSession(newSession);
                if (!newSession?.user) {
                    // Clear cached profile on sign-out
                    queryClient.removeQueries({ queryKey: ['auth', 'profile'] });
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ── Auth Actions ──

    /** Register a new account with email + password via Supabase Auth. */
    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) return { error: error.message };
        return { error: null };
    };

    /** Sign in with existing email + password credentials. */
    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
    };

    /**
     * Google OAuth sign-in flow.
     * Opens an in-app browser for Google consent, then extracts the session
     * from the redirect URL (supports both implicit and PKCE flows).
     */
    const signInWithGoogle = async () => {
        try {
            // In Expo Go, custom schemes aren't registered — use exp:// instead
            const isExpoGo = Constants.appOwnership === 'expo';
            const redirectTo = makeRedirectUri(
                isExpoGo ? {} : { scheme: 'chhehchhawl' }
            );
            if (__DEV__) console.log('[Google OAuth] Redirect URI:', redirectTo);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) return { error: error.message };
            if (!data.url) return { error: 'No OAuth URL returned' };

            const result = await WebBrowser.openAuthSessionAsync(
                data.url,
                redirectTo,
                { showInRecents: true }
            );

            if (result.type === 'success') {
                const url = result.url;

                // Try extracting tokens from hash fragment (implicit flow)
                const hashIdx = url.indexOf('#');
                if (hashIdx !== -1) {
                    const hashParams = new URLSearchParams(url.substring(hashIdx + 1));
                    const accessToken = hashParams.get('access_token');
                    const refreshToken = hashParams.get('refresh_token');
                    if (accessToken && refreshToken) {
                        await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        return { error: null };
                    }
                }

                // Try extracting code from query params (PKCE flow)
                const qIdx = url.indexOf('?');
                if (qIdx !== -1) {
                    const queryParams = new URLSearchParams(url.substring(qIdx + 1));
                    const code = queryParams.get('code');
                    if (code) {
                        const { error: exchangeError } =
                            await supabase.auth.exchangeCodeForSession(code);
                        if (exchangeError) return { error: exchangeError.message };
                        return { error: null };
                    }
                }

                return { error: 'Failed to extract session from callback' };
            }

            if (result.type === 'cancel' || result.type === 'dismiss') {
                return { error: 'OAuth cancelled' };
            }

            return { error: 'OAuth flow failed' };
        } catch (err: any) {
            return { error: err.message || 'Google sign-in failed' };
        }
    };

    /** Send a native Supabase OTP to the given phone number. */
    const signInWithPhone = async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (error) return { error: error.message };
        return { error: null };
    };

    /** Verify a native Supabase SMS OTP. */
    const verifyPhoneOtp = async (phone: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });
        if (error) return { error: error.message };
        return { error: null };
    };

    /**
     * Send OTP via a custom Supabase RPC (`send_phone_otp`).
     * Uses a server-side function — no external SMS provider needed.
     * Returns `otpPreview` in dev builds for easy testing.
     */
    const sendPhoneVerification = async (phone: string): Promise<{ error: string | null; otpPreview?: string }> => {
        const { data, error } = await supabase.rpc('send_phone_otp', { p_phone: phone });
        if (error) {
            if (
                error.message.includes('User from sub claim in JWT does not exist') ||
                error.message.includes('user_not_found')
            ) {
                if (__DEV__) console.warn('[Auth] User no longer exists. Forcing sign-out.');
                await signOut();
                return { error: 'Your session has expired. Please sign in again.' };
            }
            return { error: error.message };
        }
        if (data && !data.success) {
            return { error: data.error || 'Failed to send OTP' };
        }
        // otp_preview is returned for development only — remove in production
        return { error: null, otpPreview: data?.otp_preview };
    };

    /** Verify OTP via custom Supabase RPC (`verify_phone_otp`). */
    const verifyPhoneCode = async (phone: string, token: string) => {
        const { data, error } = await supabase.rpc('verify_phone_otp', { p_phone: phone, p_otp: token });
        if (error) return { error: error.message };
        if (data && !data.success) {
            return { error: data.error || 'Verification failed' };
        }
        return { error: null };
    };

    /** Partially update the current user's profile via a TanStack mutation. */
    const updateProfile = async (data: Partial<Profile>) => {
        if (!session?.user?.id) return { error: 'Not authenticated' };

        try {
            await updateProfileMutation.mutateAsync(data);
            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Failed to update profile' };
        }
    };

    /** Sign out: clear session, wipe all query caches, call Supabase signOut. */
    const signOut = async () => {
        try {
            setIsLoading(true);
            setSession(null);
            // Clear all query caches on sign-out
            queryClient.clear();
            await supabase.auth.signOut();
        } catch (err) {
            if (__DEV__) console.error('Sign-out error:', err);
        } finally {
            setSession(null);
            setIsLoading(false);
        }
    };

    const isAuthenticated = !!session?.user;
    const isProfileComplete = !!profile?.profile_completed;
    const combinedLoading = isLoading || (isAuthenticated && profileLoading);

    const value = useMemo<AuthContextType>(
        () => ({
            session,
            user: session?.user ?? null,
            profile,
            isLoading: combinedLoading,
            isAuthenticated,
            isProfileComplete,
            signUp,
            signIn,
            signInWithGoogle,
            signInWithPhone,
            verifyPhoneOtp,
            sendPhoneVerification,
            verifyPhoneCode,
            updateProfile,
            signOut,
            refreshProfile,
        }),
        // Auth action functions depend on stable module-level refs (supabase, queryClient)
        // and state setters — safe to omit from deps
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [session, profile, combinedLoading, isAuthenticated, isProfileComplete, refreshProfile]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/** Convenience hook to consume the AuthContext. Throws if used outside AuthProvider. */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
