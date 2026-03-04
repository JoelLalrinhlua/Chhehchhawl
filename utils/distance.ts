/**
 * distance.ts — Geo-math and human-friendly time formatting utilities.
 *
 * Exports:
 *  • `haversine`           — Great-circle distance between two lat/lng points (km).
 *  • `formatDistance`      — "1.2 km" / "800 m" display string.
 *  • `formatTimeAgo`       — "2 hours ago" long-form relative time.
 *  • `formatTimeAgoShort`  — "2h" compact relative time (used in TaskCard).
 */

/**
 * Haversine formula to calculate distance between two lat/lng points.
 * Returns distance in kilometers.
 */
export function haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return (deg * Math.PI) / 180;
}

/**
 * Format a distance in km for display.
 * <1km → "<1km", >20km → ">20km", else rounded to 1 decimal.
 */
export function formatDistance(km: number): string {
    if (km < 1) return '<1km';
    if (km > 20) return '>20km';
    return `${km.toFixed(1)}km`;
}

/**
 * Format relative time since a date string.
 */
export function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

/**
 * Short time ago for compact cards (no "ago" suffix).
 */
export function formatTimeAgoShort(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
}
