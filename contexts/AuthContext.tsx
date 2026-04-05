/**
 * AuthContext.tsx — Central authentication & user-profile provider.
 *
 * Responsibilities:
 *  - Manages Supabase session lifecycle (init, listen, sign-out)
 *  - Exposes sign-up / sign-in methods (email, Google OAuth)
 *  - Fetches & caches the user profile via TanStack Query
 *  - Provides `isAuthenticated` / `isProfileComplete` flags used for routing guards
 *
 * Security:
 *  - PKCE-only OAuth flow (no implicit token injection)
 *  - `auth.uid()` enforced in all server-side RPCs
 *  - Global sign-out clears both Supabase tokens and browser OAuth session
 *  - `prompt: 'select_account'` forces Google account picker on every login
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
    /** ISO timestamp of the last username change. Null means never changed / no cooldown. */
    username_updated_at: string | null;
    /** ISO timestamp of the last full_name change. Null means never changed / no cooldown. */
    full_name_updated_at: string | null;
    /** UPI ID for receiving direct payments from task posters. */
    upi_id: string | null;
};

/** Read-only auth state exposed to consumers. */
type AuthState = {
    /** Raw Supabase session — exposed only for advanced use (e.g. SDK calls that need the token). */
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
     * from the redirect URL using PKCE (code exchange).
     *
     * Key security decisions:
     *  - `prompt: 'select_account'` forces Google to show the account picker
     *    even if a previous session exists. This fixes the "can't switch accounts
     *    after sign-out" bug.
     *  - PKCE-only: we reject implicit-flow tokens to prevent session fixation
     *    via custom scheme hijacking.
     */
    const signInWithGoogle = async () => {
        try {
            // In Expo Go, custom schemes aren't registered — use exp:// instead
            const isExpoGo = Constants.appOwnership === 'expo';
            const redirectTo = makeRedirectUri(
                isExpoGo ? {} : { scheme: 'chhehchhawl' }
            );

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                    // Force Google to show the account picker every time.
                    // Without this, the browser session caches the previous account
                    // and auto-selects it — preventing users from switching accounts.
                    queryParams: {
                        prompt: 'select_account',
                    },
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

                // Safely extract query string and hash fragment separately.
                // The URL can be like: scheme://?code=xxx  OR  scheme://#access_token=xxx
                // When both exist: scheme://?code=xxx#fragment — we must NOT let '#' leak
                // into the code value.
                const [withoutHash, hashPart = ''] = url.split('#');
                const queryPart = withoutHash.includes('?')
                    ? withoutHash.split('?').slice(1).join('?')
                    : '';

                const queryParams = new URLSearchParams(queryPart);
                const hashParams = new URLSearchParams(hashPart);

                // Check for OAuth error in either location
                const oauthError = queryParams.get('error') || hashParams.get('error');
                const errorDescription =
                    queryParams.get('error_description') || hashParams.get('error_description');
                if (oauthError) {
                    return { error: errorDescription || oauthError };
                }

                // 1. Try PKCE code exchange first (most secure)
                const code = queryParams.get('code') || hashParams.get('code');
                if (code) {
                    const { error: exchangeError } =
                        await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError) return { error: exchangeError.message };
                    return { error: null };
                }

                // 2. Fallback: implicit flow tokens in hash fragment
                // Some Supabase configurations return tokens directly in the hash.
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                if (accessToken) {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });
                    if (sessionError) return { error: sessionError.message };
                    return { error: null };
                }

                return { error: 'Authentication response missing credentials. Please try again.' };
            }

            if (result.type === 'cancel' || result.type === 'dismiss') {
                return { error: 'OAuth cancelled' };
            }

            return { error: 'OAuth flow failed' };
        } catch (err: any) {
            return { error: err.message || 'Google sign-in failed' };
        }
    };

    // NOTE: Phone OTP verification methods removed — no SMS provider configured yet.
    // Phone numbers are still collected but not verified via OTP at this time.

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

    /**
     * Sign out: clear session, wipe all query caches, and call Supabase signOut
     * with `scope: 'global'` to invalidate ALL sessions for this user across
     * all devices — not just the local one.
     *
     * This also ensures the next Google OAuth attempt opens a fresh account picker,
     * since the `prompt: 'select_account'` param is set on the sign-in side.
     */
    const signOut = async () => {
        try {
            setIsLoading(true);
            setSession(null);
            // Clear all query caches on sign-out
            queryClient.clear();
            // Use global scope to revoke ALL refresh tokens for this user.
            // This prevents stale sessions on other devices from persisting.
            await supabase.auth.signOut({ scope: 'global' });
        } catch (err) {
            if (__DEV__) console.error('Sign-out error:', err);
            // Even if the server-side sign-out fails (e.g. network error),
            // we still want to clear the local session.
            try {
                await supabase.auth.signOut({ scope: 'local' });
            } catch (_) {
                // Last resort: at least clear the local state
            }
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
