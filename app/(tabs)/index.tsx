import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import {
  ArrowsPointingOutIcon,
  ChevronDownIcon,
  FireIcon,
  TrophyIcon,
  UsersIcon
} from 'react-native-heroicons/outline';
import {
  BoltIcon,
  ClockIcon,
  CloudIcon,
  StarIcon,
  UserIcon,
} from 'react-native-heroicons/solid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GlassSurface } from '@/components/ui/GlassSurface';
import * as Haptics from 'expo-haptics';
import { useTabBarInset, useTabBarScrollHandler } from '@/contexts/TabBarContext';
import { useTranslation } from 'react-i18next';
import { GlassActionGroup } from '@/components/ui/GlassActionGroup';
import { TrackingMenu, type AnchorFrame } from '@/components/home/TrackingMenu';
import { useTracking } from '@/contexts/TrackingContext';
import { useWeather } from '@/hooks/useWeather';
import { WeatherDetailsModal } from '@/components/modals/WeatherDetailsModal';
import { TrophyDetailsModal } from '@/components/modals/TrophyDetailsModal';
import { trophyAPI, type Trophy, type UserProfile } from '@/lib/api/trophies';
import { database } from '@/lib/database';
import { useTrips } from '@/lib/hooks/useTrips';
import { useHomeMessages } from '@/lib/hooks/useHomeMessages';
import { isVisibleTripType } from '@/lib/utils/tripTypeUi';
import { useQueryClient } from '@tanstack/react-query';
import { registerTripSyncCallback } from '@/lib/services/TripManager';

// Header row height (matches the 44px glass action pill) and its gap below the status bar.
const HEADER_HEIGHT = 44;
const HEADER_TOP_GAP = 8;
// Scroll distance over which the greeting fades away and the top edge fades in.
const GREETING_FADE_DISTANCE = 48;
// Scroll offset at which the tracking tile reaches the header and docks into it.
const TRACKING_DOCK_AT = HEADER_HEIGHT + Spacing.md + 8;
const DOCK_SPRING = { damping: 14, stiffness: 180, mass: 0.8 };

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Fixed equal column widths so both tile rows line up regardless of their text.
  const tileColumnWidth = Math.floor((windowWidth - Spacing.lg * 2 - Spacing.md) / 2);
  const tileWideStyle = { width: tileColumnWidth };
  const tileNarrowStyle = { width: tileColumnWidth };
  const scrollY = useSharedValue(0);
  const tabBarScroll = useTabBarScrollHandler(scrollY);

  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, GREETING_FADE_DISTANCE], [1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [-80, 0, GREETING_FADE_DISTANCE], [1.08, 1, 0.94], Extrapolation.CLAMP) },
    ],
  }));

  // 0 = tracking lives in its tile, 1 = docked as a glass button beside the action pill.
  const trackingDock = useSharedValue(0);
  useAnimatedReaction(
    () => (scrollY.value > TRACKING_DOCK_AT ? 1 : 0),
    (docked, previous) => {
      if (docked !== previous) trackingDock.value = withSpring(docked, DOCK_SPRING);
    }
  );

  // The tile shrinks and fades as it "lifts off" towards the header.
  const trackingTileStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, TRACKING_DOCK_AT], [1, 0.2], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(scrollY.value, [0, TRACKING_DOCK_AT], [1, 0.92], Extrapolation.CLAMP) }],
  }));

  // The docked capsule bubbles out of the action pill's left edge as a circle,
  // then stretches left to fill the header. Its right edge is the transform
  // origin, so scaleX grows it leftwards. Scale instead of opacity: glass stops
  // rendering at opacity 0; only the (non-glass) content fades.
  const dockWidth = useSharedValue(0);
  const dockedTrackingStyle = useAnimatedStyle(() => {
    const circleScaleX = dockWidth.value > 0 ? HEADER_HEIGHT / dockWidth.value : 1;
    return {
      transform: [
        { translateX: interpolate(trackingDock.value, [0, 0.35], [Spacing.sm + HEADER_HEIGHT / 2, 0], Extrapolation.CLAMP) },
        { scaleX: interpolate(trackingDock.value, [0, 0.35, 1], [0.01, circleScaleX, 1], Extrapolation.CLAMP) },
        { scaleY: interpolate(trackingDock.value, [0, 0.35, 1], [0.01, 1, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  const dockedContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(trackingDock.value, [0.6, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const dockedPress = useSharedValue(1);
  const dockedPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: dockedPress.value }] }));

  const scrollEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [GREETING_FADE_DISTANCE / 2, GREETING_FADE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));
  const tabBarInset = useTabBarInset();
  const { formatDistance, formatWeight, formatTemperature, distanceUnit, weightUnit, kmToDistance, kgToWeight } = useUnits();
  const { isTracking, toggleTracking } = useTracking();
  const { weather, loading: weatherLoading } = useWeather();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState(false);
  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null);
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ratedTripIds, setRatedTripIds] = useState<Set<string>>(new Set());
  const toggleRef = useRef<any>(null);
  const dockedTrackingRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState<AnchorFrame>({ x: 0, y: 0, width: 0, height: 0 });

  // Fetch completed trips from backend
  const { data: backendTrips, refetch: refetchTrips } = useTrips({ status: 'completed' });

  // Fetch AI-generated home messages (cached 12h client-side, 24h server-side)
  const { data: homeMessages } = useHomeMessages();

  // Invalidate home-messages cache after a trip syncs successfully
  const queryClient = useQueryClient();
  useEffect(() => {
    const unregister = registerTripSyncCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['home-messages'] });
    });
    return unregister;
  }, [queryClient]);

  // Calculate unrated trips count (must match unrated-trips.tsx filtering)
  const unratedTripsCount = useMemo(() => {
    if (!backendTrips) return 0;

    return backendTrips
      .filter((trip) => trip.is_valid !== false) // Exclude invalid/drift trips
      .filter((trip) => trip.route && trip.route.length > 0) // Only trips with route data
      .filter((trip) => isVisibleTripType(trip.type)) // v1: only walk + cycle (run/drive hidden)
      .filter((trip) => !ratedTripIds.has(trip.client_id)) // Only unrated trips
      .length;
  }, [backendTrips, ratedTripIds]);

  /**
   * Generate encouraging trophy message based on earned trophies
   * NOTE: This will be replaced with AI-generated personalized messages in a future version
   */
  const trophySummaryMessage = useMemo(() => {
    const earnedCount = trophies.filter((t) => t.is_earned).length;
    const totalCount = trophies.length;
    const unearnedCount = totalCount - earnedCount;

    if (totalCount === 0) {
      return "Start your journey to earn amazing trophies!";
    }

    if (earnedCount === 0) {
      return `${totalCount} trophies are waiting for you. Start riding to earn your first one!`;
    }

    if (earnedCount === totalCount) {
      return `Amazing! You've earned all ${totalCount} trophies! You're a true champion! 🏆`;
    }

    // Different messages based on progress
    const percentageEarned = (earnedCount / totalCount) * 100;

    if (percentageEarned >= 75) {
      return `You're almost there! ${earnedCount} down, only ${unearnedCount} more trophy${unearnedCount === 1 ? '' : 'ies'} to go!`;
    } else if (percentageEarned >= 50) {
      return `Great progress! You've earned ${earnedCount} out of ${totalCount} trophies. Keep it up!`;
    } else if (percentageEarned >= 25) {
      return `You've unlocked ${earnedCount} trophy${earnedCount === 1 ? '' : 'ies'}! ${unearnedCount} more to discover. Keep riding!`;
    } else {
      return `You've earned ${earnedCount} trophy${earnedCount === 1 ? '' : 'ies'}! ${unearnedCount} more waiting to be unlocked. You've got this! 🚴`;
    }
  }, [trophies]);

  // Load user profile and trophies from backend
  const loadUserData = useCallback(async () => {
    try {
      // Load profile for stats
      const profile = await trophyAPI.getUserProfile();
      setUserProfile(profile);

      // Load trophies separately since /api/profile/ may not include them
      const fetchedTrophies = await trophyAPI.getTrophies();
      setTrophies(fetchedTrophies);
    } catch (err) {
      // Session-expired errors are handled by the auth flow — don't trigger red LogBox
      if (err instanceof Error && err.message.includes('Session expired')) {
        console.warn('[HomeScreen] Session expired, skipping profile load');
      } else {
        console.error('[HomeScreen] Error loading user profile:', err);
      }
      // Fallback to cached trophies if available
      const cached = await trophyAPI.getCachedTrophies();
      if (cached) {
        setTrophies(cached);
      }
    }

    // Load rated trip IDs from local database
    try {
      await database.init();
      const ratings = await database.getAllRatings();
      const ratedIds = new Set(ratings.map((r) => r.trip_id));
      setRatedTripIds(ratedIds);
    } catch (err) {
      console.error('[HomeScreen] Error loading ratings:', err);
    }
  }, []);

  // Refresh user data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadUserData();
      refetchTrips();
    }, [loadUserData, refetchTrips])
  );

  // Opens the tracking menu anchored to whichever control was tapped (tile or docked button).
  const openMenu = (anchorRef: { current: any } = toggleRef) => {
    if (anchorRef.current && anchorRef.current.measureInWindow) {
      anchorRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setMenuAnchor({ x, y, width, height });
        setIsMenuOpen(true);
      });
    } else {
      setIsMenuOpen(true);
    }
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.container}>

        {/* Dropdown Menu for Tracking State */}
        <TrackingMenu
          visible={isMenuOpen}
          anchor={menuAnchor}
          isTracking={isTracking}
          onClose={() => setIsMenuOpen(false)}
          onSelect={(tracking) => {
            if (tracking !== isTracking) toggleTracking();
          }}
        />

        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + HEADER_TOP_GAP, paddingBottom: tabBarInset },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScroll}
          scrollEventThrottle={16}
        >
          {/* Greeting scrolls away with the content; the action pill stays floating. */}
          <Animated.View style={[styles.headerContainer, greetingStyle]}>
            <ThemedText type="subtitle" style={styles.headerDate} numberOfLines={1}>
              {userProfile?.name ? t('home:header.greeting', { name: userProfile.name }) : t('home:header.greetingAnonymous')}
            </ThemedText>
          </Animated.View>

          {/* Top Tiles (2x2 grid) */}
          <View style={styles.topTiles}>
            <View style={styles.tileRow}>
              {/* Background Tracking Toggle */}
              <Animated.View style={[tileWideStyle, trackingTileStyle]}>
              <TouchableOpacity
                ref={toggleRef}
                style={[styles.tile, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => openMenu()}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.tileIcon,
                    { backgroundColor: isTracking ? colors.trackingActive : '#9CA3AF' },
                  ]}
                >
                  {isTracking ? (
                    <BoltIcon size={16} color="#FFFFFF" />
                  ) : (
                    <UserIcon size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {isTracking ? t('home:header.tracking.on') : t('home:header.tracking.off')}
                  </ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('home:header.tracking.subtitle')}
                  </ThemedText>
                </View>
                <ChevronDownIcon size={16} color={colors.icon} />
              </TouchableOpacity>
              </Animated.View>

              {/* Weather Display */}
              <TouchableOpacity
                style={[styles.tile, tileNarrowStyle, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => setIsWeatherModalOpen(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: '#E0F2FE' }]}>
                  <CloudIcon size={16} color="#0284C7" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {weatherLoading ? '--' : weather?.temperature ? formatTemperature(weather.temperature, 0) : '--'}
                  </ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {weatherLoading ? 'Loading...' : weather?.city ?? 'Unknown'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.tileRow}>
              <TouchableOpacity
                style={[styles.tile, tileWideStyle, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => router.push('/home/unrated-trips')}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.accent }]}>
                  <StarIcon size={18} color="#FFFFFF" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Rate My Routes</ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {unratedTripsCount > 0 ? `${unratedTripsCount} trips to rate` : 'All rated!'}
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tile, tileNarrowStyle, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => router.push('/home/trip-history')}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.primary }]}>
                  <ClockIcon size={18} color="#FFFFFF" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Trip History</ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    Past trips
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Card */}
          <View style={styles.statsSection}>
            {/* Combined Stats and Summary Card */}
            <View style={[styles.statsCardContainer, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {/* Top highlight for 3D effect - only in light mode */}
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                
                {/* Stats Grid */}
                <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/walking.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>
                    {kmToDistance(userProfile?.stats.total_distance_walk || 0).toFixed(1)}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{distanceUnit} walked</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/cycling.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>
                    {kmToDistance(userProfile?.stats.total_distance_ride || 0).toFixed(1)}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{distanceUnit} cycled</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/star.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>
                    {userProfile?.stats.total_rides || 0}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home:stats.rides')}</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/co2.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>
                    {kgToWeight(userProfile?.stats.co2_saved || 0).toFixed(1)}
                  </ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{weightUnit} CO₂</ThemedText>
                </View>
              </View>

              {/* Divider between sections */}
              <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

              {/* Summary Section */}
              <View style={styles.summarySection}>
                <View style={styles.summaryHeader}>
                  <FireIcon size={18} color="#F59E0B" />
                  <ThemedText style={styles.summaryTitle}>{t('home:messages.greatProgress')}</ThemedText>
                </View>
                <ThemedText style={[styles.summaryText, { color: colors.textSecondary }]}>
                  {homeMessages?.stats_message ||
                    `You've walked ${formatDistance(userProfile?.stats.total_distance_walk || 0)} and cycled ${formatDistance(userProfile?.stats.total_distance_ride || 0)}, saving ${formatWeight(userProfile?.stats.co2_saved || 0)} of CO₂. Keep up the amazing work!`}
                </ThemedText>
              </View>
              </View>
            </View>
          </View>

          {/* Streak Card */}
          <View style={styles.streakSection}>
            <View style={[styles.streakCardContainer, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {/* Top highlight for 3D effect - only in light mode */}
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                
                {/* Week Days */}
                <View style={styles.streakCalendar}>
                  <View style={styles.weekDays}>
                    {(() => {
                      // Get the last 7 days, ending with today
                      const today = new Date();
                      const weekDays = userProfile?.streak?.week_days || [];
                      const days = [];

                      for (let i = 6; i >= 0; i--) {
                        const date = new Date(today);
                        date.setDate(today.getDate() - i);
                        const dayLetter = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][date.getDay()];
                        const isToday = i === 0;
                        // Use the has_activity data from backend
                        const dayIndex = 6 - i; // Convert from reverse index to forward index
                        const isActive = weekDays[dayIndex]?.has_activity || false;

                        days.push(
                          <View key={i} style={styles.dayContainer}>
                            <View style={[
                              styles.dayCircle,
                              {
                                backgroundColor: isActive ? colors.primary : colors.card,
                                borderColor: isActive ? colors.primary : colors.border,
                              }
                            ]}>
                              <ThemedText style={[
                                styles.dayText,
                                { color: isActive ? '#FFFFFF' : colors.text }
                              ]}>
                                {dayLetter}
                              </ThemedText>
                            </View>
                            {isToday && (
                              <View style={[styles.todayIndicator, { backgroundColor: colors.primary }]} />
                            )}
                          </View>
                        );
                      }

                      return days;
                    })()}
                  </View>
                </View>
                
                {/* Divider */}
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
                
                {/* Streak Summary */}
                <View style={styles.streakSummary}>
                  <View style={styles.streakHeader}>
                    <FireIcon size={18} color={colors.primary} />
                    <ThemedText style={styles.streakTitle}>
                      {t('home:streak.title', { count: userProfile?.streak?.current || 0 })}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.callToAction, { color: colors.textSecondary }]}>
                    {homeMessages?.streak_message || `${t('home:streak.cta')} 🚴`}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Trophies */}
          <View style={styles.trophiesSection}>
            {/* Trophies Card */}
            <View style={[styles.trophiesCardContainer, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {/* Top highlight for 3D effect - only in light mode */}
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                
                {/* Horizontal Scrollable Trophies */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trophiesScrollContent}
                  style={styles.trophiesScroll}
                >
                  {trophies.length === 0 ? (
                    <View style={styles.emptyTrophiesContainer}>
                      <ThemedText style={[styles.emptyTrophiesText, { color: colors.textSecondary }]}>
                        No trophies available yet
                      </ThemedText>
                    </View>
                  ) : (
                    trophies.map((trophy) => (
                      <TouchableOpacity
                        key={trophy.code}
                        style={styles.trophyItem}
                        onPress={() => {
                          setSelectedTrophy(trophy);
                          setIsTrophyModalOpen(true);
                        }}
                      >
                        <View style={styles.trophyIconWrapper}>
                          <Image
                            source={require('@/assets/images/page-icons/trophy.png')}
                            style={[
                              styles.trophyIcon,
                              { opacity: trophy.is_earned ? 1 : 0.4 }
                            ]}
                          />
                        </View>
                        <ThemedText style={styles.trophyTitle} numberOfLines={2}>
                          {trophy.name}
                        </ThemedText>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>

                {/* Divider */}
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

                {/* Trophies Summary */}
                <View style={styles.trophiesSummary}>
                  <View style={styles.trophiesHeader}>
                    <View style={styles.trophiesTitleRow}>
                      <TrophyIcon size={18} color="#F59E0B" />
                      <ThemedText style={styles.trophiesSummaryTitle}>Trophies</ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.expandIconButton}
                      onPress={() => router.push('/home/trophies')}
                    >
                      <ArrowsPointingOutIcon size={18} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={[styles.trophiesSummaryText, { color: colors.textSecondary }]}>
                    {homeMessages?.trophy_message || trophySummaryMessage}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* ===========================================
              GOALS SECTION - HIDDEN FOR NEXT VERSION
              ===========================================
              This section is planned for release in the next version.
              Keeping the code commented out for future implementation.
          */}
          {/* <View style={styles.goalsSection}>
            <View style={[styles.goalsCardContainer, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}

                <View style={styles.goalsContent}>
                  {[
                    { id: 1, title: `Ride ${formatDistance(50)} this week`, current: 32, target: 50, color: '#3B82F6', bg: '#DBEAFE' },
                    { id: 2, title: 'Walk 5 times this week', current: 3, target: 5, color: '#10B981', bg: '#DCFCE7' },
                    { id: 3, title: `Save ${formatWeight(10)} CO₂ this month`, current: 7.5, target: 10, color: '#F59E0B', bg: '#FEF3C7' },
                  ].map((goal) => {
                    const progress = (goal.current / goal.target) * 100;
                    return (
                      <View key={goal.id} style={styles.goalItem}>
                        <View style={styles.goalHeader}>
                          <ThemedText style={styles.goalTitle}>{goal.title}</ThemedText>
                          <ThemedText style={[styles.goalProgress, { color: goal.color }]}>
                            {goal.current}/{goal.target}
                          </ThemedText>
                        </View>
                        <View style={[styles.progressBarBg, { backgroundColor: goal.bg }]}>
                          <View
                            style={[
                              styles.progressBarFill,
                              { width: `${progress}%`, backgroundColor: goal.color }
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

                <View style={styles.goalsSummary}>
                  <View style={styles.goalsHeader}>
                    <View style={styles.goalsTitleRow}>
                      <ThemedText style={styles.goalsSummaryTitle}>Goals</ThemedText>
                    </View>
                    <TouchableOpacity
                      style={styles.expandIconButton}
                      onPress={() => router.push('/home/goals')}
                    >
                      <ArrowsPointingOutIcon size={18} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={[styles.goalsSummaryText, { color: colors.textSecondary }]}>
                    You're doing great! Keep pushing towards your weekly and monthly targets.
                  </ThemedText>
                </View>
              </View>
            </View>
          </View> */}

        </Animated.ScrollView>

        {/* Scroll edge: fades in once content slides under the status bar and pill. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.scrollEdge, { height: insets.top + HEADER_HEIGHT + HEADER_TOP_GAP * 2 }, scrollEdgeStyle]}
        >
          <LinearGradient
            colors={[colors.background, colors.background, `${colors.background}00`]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View pointerEvents="box-none" style={[styles.floatingActions, { top: insets.top + HEADER_TOP_GAP }]}>
          <Animated.View
            ref={dockedTrackingRef}
            collapsable={false}
            onLayout={(e) => {
              dockWidth.value = e.nativeEvent.layout.width;
            }}
            style={[styles.dockedTracking, { shadowColor: colors.shadow }, dockedTrackingStyle]}
          >
            <Animated.View style={[styles.dockedTrackingInner, dockedPressStyle]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isTracking ? t('home:header.tracking.on') : t('home:header.tracking.off')}
                onPress={() => openMenu(dockedTrackingRef)}
                onPressIn={() => {
                  dockedPress.value = withSpring(0.94, { damping: 15, stiffness: 400 });
                  if (process.env.EXPO_OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                onPressOut={() => {
                  dockedPress.value = withSpring(1, { damping: 15, stiffness: 400 });
                }}
                style={styles.dockedTrackingContent}
              >
                <GlassSurface borderRadius={HEADER_HEIGHT / 2} interactive />
                <Animated.View style={[styles.dockedTrackingRow, dockedContentStyle]}>
                  <View
                    style={[
                      styles.dockedTrackingIcon,
                      { backgroundColor: isTracking ? colors.trackingActive : '#9CA3AF' },
                    ]}
                  >
                    {isTracking ? <BoltIcon size={16} color="#FFFFFF" /> : <UserIcon size={16} color="#FFFFFF" />}
                  </View>
                  <ThemedText style={styles.dockedTrackingLabel} numberOfLines={1}>
                    {isTracking ? t('home:header.tracking.on') : t('home:header.tracking.off')}
                  </ThemedText>
                  <ChevronDownIcon size={14} color={colors.glassInactive} />
                </Animated.View>
              </Pressable>
            </Animated.View>
          </Animated.View>
          <GlassActionGroup
            actions={[
              { key: 'leaderboards', icon: TrophyIcon, accessibilityLabel: t('common:headerActions.leaderboards'), onPress: () => router.push('/feed/leaderboards') },
              { key: 'clubs', icon: UsersIcon, accessibilityLabel: t('common:headerActions.myClubs'), onPress: () => router.push('/clubs/my-clubs') },
            ]}
          />
        </View>

        {/* Weather Details Modal */}
        <WeatherDetailsModal
          visible={isWeatherModalOpen}
          onClose={() => setIsWeatherModalOpen(false)}
          weather={weather}
        />
 
        {/* Trophy Details Modal */}
        <TrophyDetailsModal
          visible={isTrophyModalOpen}
          onClose={() => setIsTrophyModalOpen(false)}
          trophy={selectedTrophy}
        />
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    // Keep the greeting clear of the floating action pill.
    paddingRight: 112,
    transformOrigin: 'left center',
  },
  headerDate: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  scrollEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  // Spans the header: the docked tracking capsule fills the space left of the pill.
  floatingActions: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dockedTracking: {
    flex: 1,
    height: HEADER_HEIGHT,
    borderRadius: HEADER_HEIGHT / 2,
    // Grow out of the pill's edge, i.e. from the right.
    transformOrigin: 'right center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  dockedTrackingInner: {
    flex: 1,
  },
  dockedTrackingContent: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 7,
    paddingRight: 14,
  },
  dockedTrackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dockedTrackingIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockedTrackingLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  topTiles: {
    paddingTop: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  tile: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 8,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tileTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  tileSubtitle: {
    fontSize: 11,
    marginTop: -2,
  },
  iconHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 14,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  statsSection: {
    marginBottom: Spacing.md,
  },
  statsCardContainer: {
    borderRadius: 20,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardInner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statIcon: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
  },
  statIconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  summarySection: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  streakSection: {
    marginBottom: Spacing.md,
  },
  streakCardContainer: {
    borderRadius: 20,
  },
  streakCalendar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  dayContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  todayIndicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  streakSummary: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  callToAction: {
    fontSize: 14,
    lineHeight: 20,
  },
  trophiesSection: {
    marginBottom: Spacing.md,
  },
  trophiesCardContainer: {
    borderRadius: 20,
  },
  trophiesScroll: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  trophiesScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  trophyItem: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  trophyIconWrapper: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIcon: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
  },
  trophyTitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 90,
    lineHeight: 14,
  },
  trophyEmoji: {
    fontSize: 48,
  },
  emptyTrophiesContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTrophiesText: {
    fontSize: 14,
    textAlign: 'center',
  },
  trophiesSummary: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  trophiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trophiesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trophiesSummaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  expandIconButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophiesSummaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // ===========================================
  // GOALS STYLES - HIDDEN FOR NEXT VERSION
  // ===========================================
  // Keeping styles commented out for future implementation
  // goalsSection: {
  //   marginBottom: Spacing.md,
  // },
  // goalsCardContainer: {
  //   borderRadius: 20,
  // },
  // goalsContent: {
  //   padding: Spacing.lg,
  //   paddingTop: Spacing.lg,
  //   paddingBottom: Spacing.md,
  //   gap: Spacing.lg,
  // },
  // goalItem: {
  //   gap: Spacing.xs,
  // },
  // goalHeader: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   marginBottom: Spacing.xs,
  // },
  // goalTitle: {
  //   fontSize: 14,
  //   fontWeight: '600',
  //   flex: 1,
  // },
  // goalProgress: {
  //   fontSize: 14,
  //   fontWeight: '700',
  // },
  // progressBarBg: {
  //   height: 8,
  //   borderRadius: 4,
  //   overflow: 'hidden',
  // },
  // progressBarFill: {
  //   height: '100%',
  //   borderRadius: 4,
  // },
  // goalsSummary: {
  //   padding: Spacing.md,
  //   paddingTop: Spacing.md,
  //   gap: Spacing.sm,
  // },
  // goalsHeader: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  // },
  // goalsTitleRow: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   gap: 8,
  // },
  // goalsSummaryTitle: {
  //   fontSize: 15,
  //   fontWeight: '600',
  // },
  // goalsSummaryText: {
  //   fontSize: 14,
  //   lineHeight: 20,
  // },
  // Quick Actions (legacy)
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonLeft: {
    flex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonRight: {
    flex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
