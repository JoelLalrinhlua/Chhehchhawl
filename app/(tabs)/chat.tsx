/**
 * (tabs)/chat.tsx — Chat list screen (placeholder).
 *
 * Currently renders a list of mock conversations with a search bar.
 * Will be replaced with a real messaging implementation backed by Supabase.
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Mock chat data
const CHATS = [
    {
        id: '1',
        name: 'Sarah Jenkins',
        message: 'Is the cleaning task still available?',
        time: '2m ago',
        unread: 2,
        avatar: 'https://i.pravatar.cc/150?u=1',
    },
    {
        id: '2',
        name: 'David Zosang',
        message: 'I can help with the plumbing issue tomorrow.',
        time: '1h ago',
        unread: 0,
        avatar: 'https://i.pravatar.cc/150?u=2',
    },
    {
        id: '3',
        name: 'Lalhruaitluanga',
        message: 'Great, thanks for confirming!',
        time: '1d ago',
        unread: 0,
        avatar: null,
    },
];

export default function ChatScreen() {
    const { colors } = useTheme();
    const [search, setSearch] = useState('');

    const renderItem = ({ item, index }: { item: typeof CHATS[0]; index: number }) => (
        <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
            <TouchableOpacity style={[styles.chatItem, { backgroundColor: colors.card }]}>
                <View style={[styles.avatar, { backgroundColor: colors.border }]}>
                    {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                    ) : (
                        <Text style={[styles.avatarText, { color: colors.text }]}>
                            {item.name[0]}
                        </Text>
                    )}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.time, { color: colors.textMuted }]}>{item.time}</Text>
                    </View>
                    <Text
                        style={[
                            styles.message,
                            {
                                color: item.unread ? colors.text : colors.textMuted,
                                fontFamily: item.unread ? FontFamily.medium : FontFamily.regular,
                            },
                        ]}
                        numberOfLines={1}
                    >
                        {item.message}
                    </Text>
                </View>
                {item.unread > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.badgeText}>{item.unread}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
                <TouchableOpacity>
                    <Ionicons name="create-outline" size={24} color={colors.accent} />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                    <Ionicons name="search" size={20} color={colors.textMuted} />
                    <TextInput
                        style={[styles.input, { color: colors.text }]}
                        placeholder="Search messages..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            <FlatList
                data={CHATS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize.xxl,
        fontFamily: FontFamily.bold,
    },
    searchContainer: {
        paddingHorizontal: Spacing.xl,
        marginBottom: Spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        fontFamily: FontFamily.regular,
        fontSize: FontSize.md,
    },
    listContent: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.huge,
        gap: Spacing.md,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.xl,
        gap: Spacing.md,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.bold,
    },
    chatContent: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    name: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
    },
    time: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
    },
    message: {
        fontSize: FontSize.sm,
    },
    badge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontFamily: FontFamily.bold,
    },
});
