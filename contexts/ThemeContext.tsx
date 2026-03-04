/**
 * ThemeContext.tsx — Dark / light theme provider.
 *
 * Defaults to dark mode. Exposes `toggleTheme()` and the current `colors` palette.
 * Consumed via the `useTheme()` hook.
 */

import { Colors, type ThemeColors } from '@/constants/theme';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface ThemeContextType {
    isDark: boolean;
    colors: ThemeColors;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    isDark: true,
    colors: Colors.dark,
    toggleTheme: () => { },
});

/** Provides the current theme colors and a toggle function to child components. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDark, setIsDark] = useState(true);

    const toggleTheme = useCallback(() => {
        setIsDark((prev) => !prev);
    }, []);

    const value = useMemo(
        () => ({
            isDark,
            colors: isDark ? Colors.dark : Colors.light,
            toggleTheme,
        }),
        [isDark, toggleTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Convenience hook to consume the ThemeContext. Throws if used outside ThemeProvider. */
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
