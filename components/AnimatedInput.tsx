/**
 * AnimatedInput.tsx — Themed TextInput with an animated border colour.
 *
 * The border smoothly transitions from the idle colour to the accent colour
 * on focus, powered by `react-native-reanimated` (`interpolateColor`).
 * Accepts all standard TextInput props plus an optional label and error message.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

interface AnimatedInputProps extends TextInputProps {
    label?: string;
    required?: boolean;
    containerStyle?: ViewStyle;
}

export function AnimatedInput({
    label,
    required,
    containerStyle,
    ...props
}: AnimatedInputProps) {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useSharedValue(0);

    const handleFocus = (e: any) => {
        setIsFocused(true);
        focusAnim.value = withTiming(1, { duration: 250 });
        props.onFocus?.(e);
    };

    const handleBlur = (e: any) => {
        setIsFocused(false);
        focusAnim.value = withTiming(0, { duration: 250 });
        props.onBlur?.(e);
    };

    const animatedBorderStyle = useAnimatedStyle(() => {
        return {
            borderColor: interpolateColor(
                focusAnim.value,
                [0, 1],
                [colors.border, colors.accent]
            ),
            borderWidth: 1.5,
        };
    });

    return (
        <View style={[styles.wrapper, containerStyle]}>
            {label && (
                <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: colors.text, fontFamily: FontFamily.medium }]}>
                        {label}
                    </Text>
                    {required && <Text style={[styles.required, { color: colors.accent }]}> *</Text>}
                </View>
            )}
            <AnimatedView style={[styles.inputContainer, { backgroundColor: colors.inputBackground }, animatedBorderStyle]}>
                <TextInput
                    {...props}
                    style={[
                        styles.input,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.regular,
                        },
                        props.style,
                    ]}
                    placeholderTextColor={colors.textMuted}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                />
            </AnimatedView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    label: {
        fontSize: FontSize.md,
    },
    required: {
        fontSize: FontSize.md,
    },
    inputContainer: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    input: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md + 2,
        fontSize: FontSize.md,
        minHeight: 48,
    },
});
