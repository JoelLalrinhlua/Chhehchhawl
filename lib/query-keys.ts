/**
 * query-keys.ts — Centralised query-key factory for TanStack Query.
 *
 * Every query in the app obtains its cache key from this factory, ensuring
 * consistent keys and making it easy to invalidate related caches.
 * Keys are grouped by domain: auth, tasks, applications.
 */
export const queryKeys = {
    // ── Auth & Profile ──
    auth: {
        session: ['auth', 'session'] as const,
        profile: (userId: string) => ['auth', 'profile', userId] as const,
        usernameCheck: (username: string) => ['auth', 'username-check', username] as const,
    },

    // ── Tasks ──
    tasks: {
        all: ['tasks'] as const,
        feed: () => ['tasks', 'feed'] as const,
        myPosts: (userId: string) => ['tasks', 'my-posts', userId] as const,
        myTasks: (userId: string) => ['tasks', 'my-tasks', userId] as const,
        detail: (taskId: string) => ['tasks', 'detail', taskId] as const,
    },

    // ── Applications ──
    applications: {
        all: ['applications'] as const,
        mine: (userId: string) => ['applications', 'mine', userId] as const,
        forTask: (taskId: string) => ['applications', 'task', taskId] as const,
        myStatus: (taskId: string, userId: string) =>
            ['applications', 'my-status', taskId, userId] as const,
        counts: (taskIds: string[]) =>
            ['applications', 'counts', ...taskIds.sort()] as const,
    },

    // ── Chat ──
    chat: {
        all: ['chat'] as const,
        rooms: (userId: string) => ['chat', 'rooms', userId] as const,
        messages: (roomId: string) => ['chat', 'messages', roomId] as const,
    },

    // ── Notifications ──
    notifications: {
        all: ['notifications'] as const,
        list: (userId: string) => ['notifications', 'list', userId] as const,
        unreadCount: (userId: string) => ['notifications', 'unread-count', userId] as const,
    },
} as const;
