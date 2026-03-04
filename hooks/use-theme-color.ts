/**
 * use-theme-color.ts — Resolves a color value based on the current system color scheme.
 *
 * Accepts an optional per-mode override via `props`; falls back to the
 * matching color from the design-system `Colors` palette.
 *
 * @see https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Return a resolved color value for either light or dark mode. */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
