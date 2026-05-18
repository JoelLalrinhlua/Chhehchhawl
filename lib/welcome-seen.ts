/** Key used to track whether the welcome screen has been shown to a given user. */
export function getWelcomeSeenKey(userId: string): string {
    return `welcome_seen_${userId}`;
}
