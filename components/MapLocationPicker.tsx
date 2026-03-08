/**
 * MapLocationPicker — Interactive Leaflet-based map for selecting task locations.
 *
 * Features:
 *  - Blue pulsing dot for user's current GPS position
 *  - Red draggable pin for task location selection
 *  - Tap-to-place marker on map
 *  - Location search with Nominatim geocoding + fuzzy matching
 *  - Dark/light theme support (Carto tile layers)
 *  - Recenter button to fly back to user location
 *
 * Communication between React Native and the WebView Leaflet map uses
 * postMessage (WebView → RN) and injectJavaScript (RN → WebView).
 */

import { BorderRadius, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

// Lazy-load WebView to prevent TurboModule crash when the native binary
// hasn't been rebuilt with react-native-webview yet.
let WebView: any = null;
let webViewAvailable = false;
try {
    WebView = require('react-native-webview').WebView;
    webViewAvailable = true;
} catch {
    webViewAvailable = false;
}

// ── Types ──

export interface LatLng {
    latitude: number;
    longitude: number;
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}

interface MapLocationPickerProps {
    /** User's current GPS coordinates (blue dot). */
    userLocation: LatLng | null;
    /** Currently selected task location (red pin). */
    selectedLocation: LatLng | null;
    /** Called when the user changes the task location (drag, tap, search). */
    onLocationSelect: (location: LatLng) => void;
    /** Theme colors from ThemeContext. */
    colors: any;
    /** Whether the theme is dark mode. */
    isDark: boolean;
    /** Whether GPS detection is in progress. */
    isDetecting?: boolean;
    /** Called when the user taps the recenter button. */
    onRecenter?: () => void;
    /** Map container height in pixels. */
    mapHeight?: number;
}

// Default center: Aizawl, Mizoram (primary app target region)
const DEFAULT_CENTER: LatLng = { latitude: 23.7271, longitude: 92.7176 };

// ── Leaflet HTML Builder ──

function buildMapHTML(isDark: boolean): string {
    const darkTiles = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const lightTiles = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const tileUrl = isDark ? darkTiles : lightTiles;

    // The HTML is self-contained: loads Leaflet from CDN, sets up the map,
    // creates custom markers, and establishes postMessage communication with RN.
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:${isDark ? '#1a1a2e' : '#f0f0f0'}}
#map{width:100%;height:100%}
.leaflet-control-attribution{font-size:7px!important;opacity:0.5}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.6);opacity:.12}}
.u-wrap{position:relative;width:40px;height:40px}
.u-pulse{width:40px;height:40px;background:rgba(66,133,244,.3);border-radius:50%;animation:pulse 2s ease-in-out infinite;position:absolute;top:0;left:0}
.u-dot{width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${DEFAULT_CENTER.latitude},${DEFAULT_CENTER.longitude}],14);

var darkUrl='${darkTiles}';
var lightUrl='${lightTiles}';
var tileLayer=L.tileLayer('${tileUrl}',{maxZoom:19,attribution:'\\u00a9 CARTO \\u00a9 OSM'}).addTo(map);

var userIcon=L.divIcon({className:'',html:'<div class="u-wrap"><div class="u-pulse"></div><div class="u-dot"></div></div>',iconSize:[40,40],iconAnchor:[20,20]});

var pinSvg='<svg width="32" height="44" viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg">'
+'<defs><filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.25"/></filter></defs>'
+'<path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 28 16 28s16-17 16-28C32 7.163 24.837 0 16 0z" fill="#E53935" filter="url(#ds)"/>'
+'<circle cx="16" cy="15" r="6" fill="white"/></svg>';

var redPinIcon=L.divIcon({className:'',html:pinSvg,iconSize:[32,44],iconAnchor:[16,44]});

var userMarker=null;
var taskMarker=null;

function setUser(lat,lng){
if(userMarker)map.removeLayer(userMarker);
userMarker=L.marker([lat,lng],{icon:userIcon,interactive:false,zIndexOffset:-100}).addTo(map);
}

function setTask(lat,lng,pan){
if(taskMarker){taskMarker.setLatLng([lat,lng])}
else{
taskMarker=L.marker([lat,lng],{icon:redPinIcon,draggable:true,zIndexOffset:100}).addTo(map);
taskMarker.on('dragend',function(){
var p=taskMarker.getLatLng();
window.ReactNativeWebView.postMessage(JSON.stringify({type:'markerMoved',latitude:p.lat,longitude:p.lng}));
});
}
if(pan)map.flyTo([lat,lng],Math.max(map.getZoom(),15),{duration:0.5});
}

map.on('click',function(e){
setTask(e.latlng.lat,e.latlng.lng,false);
window.ReactNativeWebView.postMessage(JSON.stringify({type:'markerMoved',latitude:e.latlng.lat,longitude:e.latlng.lng}));
});

function handleMessage(raw){
try{
var m=JSON.parse(raw);
if(m.type==='setUser')setUser(m.latitude,m.longitude);
else if(m.type==='setTask')setTask(m.latitude,m.longitude,m.pan!==false);
else if(m.type==='flyTo')map.flyTo([m.latitude,m.longitude],m.zoom||15,{duration:0.5});
else if(m.type==='changeTheme'){
tileLayer.setUrl(m.dark?darkUrl:lightUrl);
document.body.style.background=m.dark?'#1a1a2e':'#f0f0f0';
}
}catch(e){}
}

document.addEventListener('message',function(e){handleMessage(e.data)});
window.addEventListener('message',function(e){handleMessage(e.data)});

window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapReady'}));
<\/script>
</body></html>`;
}

// ── Component ──

export default function MapLocationPicker({
    userLocation,
    selectedLocation,
    onLocationSelect,
    colors,
    isDark,
    isDetecting = false,
    onRecenter,
    mapHeight = 260,
}: MapLocationPickerProps) {
    const webViewRef = useRef<any>(null);
    const mapReadyRef = useRef(false);
    const prevUserRef = useRef<LatLng | null>(null);
    const prevSelectedRef = useRef<LatLng | null>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [mapLoaded, setMapLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Generate HTML once per theme (theme changes during task creation are very rare)
    const mapHTML = useMemo(() => buildMapHTML(isDark), [isDark]);

    // ── Send JSON message to the WebView via injectJavaScript ──
    const sendToMap = useCallback((msg: Record<string, unknown>) => {
        if (!webViewRef.current || !mapReadyRef.current) return;
        const jsonStr = JSON.stringify(msg);
        // Double-stringify so handleMessage receives a proper JSON string
        webViewRef.current.injectJavaScript(
            `handleMessage(${JSON.stringify(jsonStr)});true;`
        );
    }, []);

    // ── Sync user location (blue dot) → map ──
    useEffect(() => {
        if (!mapLoaded || !userLocation) return;
        const prev = prevUserRef.current;
        if (
            prev &&
            prev.latitude === userLocation.latitude &&
            prev.longitude === userLocation.longitude
        )
            return;
        prevUserRef.current = userLocation;
        sendToMap({
            type: 'setUser',
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
        });
        // On first detection, fly to user
        if (!prev) {
            sendToMap({
                type: 'flyTo',
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                zoom: 16,
            });
        }
    }, [userLocation, mapLoaded, sendToMap]);

    // ── Sync selected location (red pin) → map ──
    useEffect(() => {
        if (!mapLoaded || !selectedLocation) return;
        const prev = prevSelectedRef.current;
        if (
            prev &&
            prev.latitude === selectedLocation.latitude &&
            prev.longitude === selectedLocation.longitude
        )
            return;
        prevSelectedRef.current = selectedLocation;
        sendToMap({
            type: 'setTask',
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            pan: true,
        });
    }, [selectedLocation, mapLoaded, sendToMap]);

    // ── Handle theme changes via JS injection (avoids full map reload) ──
    useEffect(() => {
        if (!mapLoaded) return;
        sendToMap({ type: 'changeTheme', dark: isDark });
    }, [isDark, mapLoaded, sendToMap]);

    // ── Receive messages from the WebView ──
    const onMessage = useCallback(
        (e: { nativeEvent: { data: string } }) => {
            try {
                const data = JSON.parse(e.nativeEvent.data);
                if (data.type === 'mapReady') {
                    mapReadyRef.current = true;
                    setMapLoaded(true);
                } else if (data.type === 'markerMoved') {
                    const loc: LatLng = {
                        latitude: data.latitude,
                        longitude: data.longitude,
                    };
                    // Prevent the useEffect from echoing this back to the map
                    prevSelectedRef.current = loc;
                    onLocationSelect(loc);
                }
            } catch {
                // Ignore malformed messages
            }
        },
        [onLocationSelect]
    );

    // ── Search with debounce (Nominatim) ──
    const handleSearchInput = useCallback((text: string) => {
        setSearchQuery(text);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (text.trim().length < 2) {
            setSearchResults([]);
            setShowSuggestions(false);
            setSearching(false);
            return;
        }

        setSearching(true);
        setShowSuggestions(true);

        searchTimerRef.current = setTimeout(async () => {
            try {
                const q = encodeURIComponent(text.trim());
                // Bias results towards northeast India but don't strictly bound
                const endpoint =
                    `https://nominatim.openstreetmap.org/search` +
                    `?q=${q}&format=json&limit=6&countrycodes=in` +
                    `&viewbox=88.0,28.5,97.5,21.0&bounded=0&addressdetails=1`;

                const res = await fetch(endpoint, {
                    headers: { 'User-Agent': 'ChhehchhawlApp/1.0' },
                });
                if (!res.ok) throw new Error('Search failed');
                const json: NominatimResult[] = await res.json();
                setSearchResults(json);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 500);
    }, []);

    const handleSelectSuggestion = useCallback(
        (item: NominatimResult) => {
            const coords: LatLng = {
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
            };
            // Show a short version of the name in the search input
            const shortName = item.display_name
                .split(',')
                .slice(0, 3)
                .join(', ')
                .trim();
            setSearchQuery(shortName);
            setShowSuggestions(false);
            setSearchResults([]);
            Keyboard.dismiss();

            // Move the red pin and pan the map
            prevSelectedRef.current = coords;
            sendToMap({
                type: 'setTask',
                latitude: coords.latitude,
                longitude: coords.longitude,
                pan: true,
            });
            onLocationSelect(coords);
        },
        [sendToMap, onLocationSelect]
    );

    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setShowSuggestions(false);
    }, []);

    // ── Render ──

    // Fallback when react-native-webview native module isn't available
    if (!webViewAvailable) {
        return (
            <View style={styles.wrapper}>
                {/* Search bar still works for geocoding without the map */}
                <View
                    style={[
                        styles.searchContainer,
                        {
                            backgroundColor: colors.inputBackground,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                        style={[
                            styles.searchInput,
                            { color: colors.text, fontFamily: FontFamily.regular },
                        ]}
                        placeholder="Search for a place or address..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={handleSearchInput}
                        onFocus={() => {
                            if (searchResults.length > 0) setShowSuggestions(true);
                        }}
                        returnKeyType="search"
                        autoCorrect={false}
                        autoCapitalize="none"
                    />
                    {searching && (
                        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 2 }} />
                    )}
                    {searchQuery.length > 0 && !searching && (
                        <Pressable onPress={clearSearch} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                    )}
                </View>

                {/* Search Suggestions */}
                {showSuggestions && searchResults.length > 0 && (
                    <Animated.View
                        entering={FadeIn.duration(200)}
                        style={[styles.suggestionsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                            {searchResults.map((item) => (
                                <Pressable
                                    key={item.place_id}
                                    style={[styles.suggestionRow, { borderBottomColor: colors.border }]}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <Ionicons name="location-outline" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                                    <Text
                                        style={[styles.suggestionText, { color: colors.text, fontFamily: FontFamily.regular }]}
                                        numberOfLines={2}
                                    >
                                        {item.display_name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </Animated.View>
                )}

                {/* Fallback map placeholder */}
                <View style={[styles.mapContainer, { height: mapHeight, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.inputBackground }]}>
                    <Ionicons name="map-outline" size={48} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontFamily: FontFamily.medium, fontSize: FontSize.sm, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
                        Interactive map requires a native rebuild.{'\n'}Run: npx expo run:android
                    </Text>
                    {isDetecting && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md }}>
                            <ActivityIndicator size="small" color={colors.accent} />
                            <Text style={{ color: colors.textMuted, fontFamily: FontFamily.regular, fontSize: FontSize.xs }}>Detecting GPS...</Text>
                        </View>
                    )}
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#4285F4' }]} />
                        <Text style={[styles.legendText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>Your location</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
                        <Text style={[styles.legendText, { color: colors.textMuted, fontFamily: FontFamily.regular }]}>Task location</Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            {/* ── Search Bar ── */}
            <View
                style={[
                    styles.searchContainer,
                    {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                    style={[
                        styles.searchInput,
                        { color: colors.text, fontFamily: FontFamily.regular },
                    ]}
                    placeholder="Search for a place or address..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={handleSearchInput}
                    onFocus={() => {
                        if (searchResults.length > 0) setShowSuggestions(true);
                    }}
                    returnKeyType="search"
                    autoCorrect={false}
                    autoCapitalize="none"
                />
                {searching && (
                    <ActivityIndicator
                        size="small"
                        color={colors.accent}
                        style={{ marginRight: 2 }}
                    />
                )}
                {searchQuery.length > 0 && !searching && (
                    <Pressable onPress={clearSearch} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </Pressable>
                )}
            </View>

            {/* ── Search Suggestions ── */}
            {showSuggestions && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[
                        styles.suggestionsContainer,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    {searchResults.length === 0 && !searching ? (
                        <View style={styles.noResultsRow}>
                            <Text
                                style={[
                                    styles.noResultsText,
                                    {
                                        color: colors.textMuted,
                                        fontFamily: FontFamily.regular,
                                    },
                                ]}
                            >
                                {searchQuery.trim().length >= 2
                                    ? 'No results found. Try different keywords.'
                                    : 'Type at least 2 characters to search...'}
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                            {searchResults.map((item) => (
                                <Pressable
                                    key={item.place_id}
                                    style={[
                                        styles.suggestionRow,
                                        { borderBottomColor: colors.border },
                                    ]}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <Ionicons
                                        name="location-outline"
                                        size={16}
                                        color={colors.accent}
                                        style={{ marginTop: 2 }}
                                    />
                                    <Text
                                        style={[
                                            styles.suggestionText,
                                            {
                                                color: colors.text,
                                                fontFamily: FontFamily.regular,
                                            },
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {item.display_name}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                </Animated.View>
            )}

            {/* ── Map ── */}
            <View
                style={[
                    styles.mapContainer,
                    { height: mapHeight, borderColor: colors.border },
                ]}
            >
                <WebView
                    ref={webViewRef}
                    source={{ html: mapHTML }}
                    style={styles.map}
                    onMessage={onMessage}
                    scrollEnabled={false}
                    bounces={false}
                    nestedScrollEnabled={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    originWhitelist={['*']}
                    mixedContentMode="compatibility"
                    startInLoadingState={true}
                    renderLoading={() => (
                        <View
                            style={[
                                styles.mapLoading,
                                {
                                    backgroundColor: isDark
                                        ? '#1a1a2e'
                                        : '#f0f0f0',
                                },
                            ]}
                        >
                            <ActivityIndicator size="large" color={colors.accent} />
                            <Text
                                style={[
                                    styles.mapLoadingText,
                                    {
                                        color: colors.textMuted,
                                        fontFamily: FontFamily.regular,
                                    },
                                ]}
                            >
                                Loading map...
                            </Text>
                        </View>
                    )}
                    // Prevent WebView from intercepting back button on Android
                    {...(Platform.OS === 'android'
                        ? { overScrollMode: 'never' as const }
                        : {})}
                />

                {/* GPS Detecting Overlay */}
                {isDetecting && (
                    <View style={styles.detectingOverlay}>
                        <ActivityIndicator size="small" color="#4285F4" />
                        <Text style={styles.detectingText}>Detecting GPS...</Text>
                    </View>
                )}

                {/* Recenter Button */}
                {onRecenter && userLocation && (
                    <Pressable
                        style={[
                            styles.recenterBtn,
                            {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => {
                            if (userLocation) {
                                sendToMap({
                                    type: 'flyTo',
                                    latitude: userLocation.latitude,
                                    longitude: userLocation.longitude,
                                    zoom: 16,
                                });
                            }
                        }}
                        hitSlop={4}
                    >
                        <Ionicons name="locate" size={20} color={colors.accent} />
                    </Pressable>
                )}
            </View>

            {/* ── Legend ── */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4285F4' }]} />
                    <Text
                        style={[
                            styles.legendText,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        Your location
                    </Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
                    <Text
                        style={[
                            styles.legendText,
                            { color: colors.textMuted, fontFamily: FontFamily.regular },
                        ]}
                    >
                        Task location
                    </Text>
                </View>
            </View>
        </View>
    );
}

// ── Styles ──

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: Spacing.md,
    },
    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        paddingHorizontal: Spacing.md,
        height: 44,
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        height: '100%',
        paddingVertical: 0,
    },
    suggestionsContainer: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: Spacing.sm + 2,
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    suggestionText: {
        flex: 1,
        fontSize: FontSize.sm,
        lineHeight: 20,
    },
    noResultsRow: {
        paddingVertical: Spacing.lg,
        alignItems: 'center',
    },
    noResultsText: {
        fontSize: FontSize.sm,
    },
    // Map
    mapContainer: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        overflow: 'hidden',
        position: 'relative',
    },
    map: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    mapLoading: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    mapLoadingText: {
        fontSize: FontSize.sm,
        marginTop: Spacing.xs,
    },
    detectingOverlay: {
        position: 'absolute',
        top: Spacing.sm,
        left: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.full,
    },
    detectingText: {
        color: '#fff',
        fontSize: FontSize.xs,
        fontWeight: '500',
    },
    recenterBtn: {
        position: 'absolute',
        bottom: Spacing.sm,
        right: Spacing.sm,
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    // Legend
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.xl,
        marginTop: Spacing.sm,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: FontSize.xs,
    },
});
