import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import {
  ArrowsPointingOutIcon,
  BeakerIcon,
  BellIcon,
  ChevronDownIcon,
  FireIcon,
  TrophyIcon
} from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/i18n/formatters';
import { useTrackingToggle } from '@/components/tracking/TrackingToggle';
import { useWeather } from '@/hooks/useWeather';
import { WeatherDetailsModal } from '@/components/modals/WeatherDetailsModal';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { formatDistance, formatWeight, formatTemperature, distanceUnit, weightUnit, kmToDistance, kgToWeight } = useUnits();
  const { isTracking, toggleTracking } = useTrackingToggle();
  const { weather, loading: weatherLoading } = useWeather();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const toggleRef = useRef<any>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; width: number }>({ x: 0, y: 0, width: 0 });
  const weatherIconName =
    (weather?.icon as keyof typeof MaterialCommunityIcons.glyphMap) ?? 'weather-partly-cloudy';

  const openMenu = () => {
    if (toggleRef.current && toggleRef.current.measureInWindow) {
      toggleRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        setMenuPos({ x, y: y + height + 8, width });
        setIsMenuOpen(true);
      });
    } else {
      setIsMenuOpen(true);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.headerContainer, { backgroundColor: colors.background }]}>
          <ThemedText type="subtitle" style={styles.headerDate}>
            {t('home:header.date', { date: formatDate(new Date(), { month: 'long', day: 'numeric' }) })}
          </ThemedText>

          <TouchableOpacity style={styles.headerIcon}>
            <BellIcon size={28} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu for Tracking State */}
        <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setIsMenuOpen(false)}>
            <View style={[styles.menuContainer, { top: menuPos.y, left: menuPos.x, width: Math.max(menuPos.width, 320), backgroundColor: colors.card }, styles.buttonShadow]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!isTracking) toggleTracking();
                  setIsMenuOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.trackingActive }]}>
                  <MaterialIcons name="directions-run" size={18} color="#fff" />
                </View>
                <View style={styles.menuTextCol}>
                  <ThemedText style={styles.menuTitle}>{t('home:header.tracking.on')}</ThemedText>
                  <ThemedText style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{t('home:header.tracking.subtitle')}</ThemedText>
                </View>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (isTracking) toggleTracking();
                  setIsMenuOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#9CA3AF' }]}>
                  <Ionicons name="man" size={18} color="#fff" />
                </View>
                <View style={styles.menuTextCol}>
                  <ThemedText style={styles.menuTitle}>{t('home:header.tracking.off')}</ThemedText>
                  <ThemedText style={[styles.menuSubtitle, { color: colors.textSecondary }]}>No background tracking</ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Tiles (2x2 grid) */}
          <View style={styles.topTiles}>
            <View style={styles.tileRow}>
              {/* Background Tracking Toggle */}
              <TouchableOpacity
                ref={toggleRef}
                style={[styles.tile, styles.tileWide, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={openMenu}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.tileIcon,
                    { backgroundColor: isTracking ? colors.trackingActive : '#9CA3AF' },
                  ]}
                >
                  {isTracking ? (
                    <MaterialIcons name="directions-run" size={16} color="#FFFFFF" />
                  ) : (
                    <Ionicons name="man" size={16} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle}>
                    {isTracking ? t('home:header.tracking.on') : t('home:header.tracking.off')}
                  </ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {t('home:header.tracking.subtitle')}
                  </ThemedText>
                </View>
                <ChevronDownIcon size={16} color={colors.icon} />
              </TouchableOpacity>

              {/* Weather Display */}
              <TouchableOpacity
                style={[styles.tile, styles.tileNarrow, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => setIsWeatherModalOpen(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: '#E0F2FE' }]}>
                  <MaterialCommunityIcons name={weatherIconName} size={16} color="#0284C7" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle}>
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
                style={[styles.tile, styles.tileWide, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => router.push('/home/manual-entry')}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="add" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle}>Add Manual Trip</ThemedText>
                  <ThemedText style={[styles.tileSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    Log a ride or walk
                  </ThemedText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tile, styles.tileNarrow, styles.buttonShadow, { backgroundColor: colors.card }]}
                onPress={() => router.push('/home/trip-history')}
                activeOpacity={0.8}
              >
                <View style={[styles.tileIcon, { backgroundColor: colors.primary }]}>
                  <MaterialIcons name="history" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.tileTextContainer}>
                  <ThemedText style={styles.tileTitle}>Trip History</ThemedText>
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
                  <ThemedText style={styles.statValue}>{kmToDistance(125.5).toFixed(1)}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{distanceUnit} walked</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/cycling.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>{kmToDistance(42.3).toFixed(1)}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{distanceUnit} ride</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/star.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>42</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>{t('home:stats.rides')}</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={styles.statIconWrapper}>
                    <Image source={require('@/assets/images/page-icons/co2.png')} style={styles.statIcon} />
                  </View>
                  <ThemedText style={styles.statValue}>{kgToWeight(15.2).toFixed(1)}</ThemedText>
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
                  You've walked {formatDistance(125.5)} and rode {formatDistance(42.3)} this week, saving {formatWeight(15.2)} of CO₂. Your recent {formatDistance(8)} evening ride brought you closer to your weekly goal. Keep up the amazing work!
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
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => {
                      const isToday = index === 3; // Thursday is today (index 3)
                      return (
                        <View key={index} style={styles.dayContainer}>
                          <View style={[
                            styles.dayCircle,
                            { 
                              backgroundColor: isToday ? '#EF4444' : colors.card,
                              borderColor: isToday ? '#EF4444' : colors.border,
                            }
                          ]}>
                            <ThemedText style={[
                              styles.dayText,
                              { color: isToday ? '#FFFFFF' : colors.text }
                            ]}>
                              {day}
                            </ThemedText>
                          </View>
                          {isToday && (
                            <View style={styles.todayIndicator} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
                
                {/* Divider */}
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
                
                {/* Streak Summary */}
                <View style={styles.streakSummary}>
                  <View style={styles.streakHeader}>
                    <FireIcon size={18} color="#EF4444" />
                    <ThemedText style={styles.streakTitle}>{t('home:streak.title', { count: 1 })}</ThemedText>
                  </View>
                  <ThemedText style={[styles.callToAction, { color: colors.textSecondary }]}>
                    {t('home:streak.cta')} 🚴
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
                  {[
                    { id: 1, title: 'First Ride', earned: true },
                    { id: 2, title: 'First Walk', earned: true },
                    { id: 3, title: 'Rides', earned: true },
                    { id: 4, title: 'Walks', earned: false },
                    { id: 5, title: 'Century', earned: false },
                    { id: 6, title: 'Distance', earned: true },
                    { id: 7, title: 'Explorer', earned: true },
                    { id: 8, title: 'Streak', earned: false },
                  ].map((trophy) => (
                    <TouchableOpacity
                      key={trophy.id}
                      style={[
                        styles.trophyItem,
                        { opacity: trophy.earned ? 1 : 0.4 }
                      ]}
                      onPress={() => router.push(`/home/badge-detail?id=${trophy.id}`)}
                    >
                      <View style={styles.trophyIconWrapper}>
                        <Image source={require('@/assets/images/page-icons/trophy.png')} style={styles.trophyIcon} />
                      </View>
                      <ThemedText style={styles.trophyTitle} numberOfLines={2}>
                        {trophy.title}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
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
                    You've got September challenge done! You need 4 more rides to complete the October challenge.
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Goals */}
          <View style={styles.goalsSection}>
            {/* Goals Card */}
            <View style={[styles.goalsCardContainer, styles.cardShadow]}>
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

                {/* Goals List */}
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

                {/* Divider */}
                <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

                {/* Goals Summary */}
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
          </View>

        </ScrollView>

        {/* Weather Details Modal */}
        <WeatherDetailsModal
          visible={isWeatherModalOpen}
          onClose={() => setIsWeatherModalOpen(false)}
          weather={weather}
        />
      </ThemedView>
    </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerDate: {
    fontSize: 22,
    fontWeight: '600',
  },
  headerIcon: {
    width: 40,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 8,
  },
  tileWide: {
    flex: 3, // 60%
  },
  tileNarrow: {
    flex: 2, // 40%
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
    backgroundColor: '#EF4444',
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
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 80,
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
  goalsSection: {
    marginBottom: Spacing.md,
  },
  goalsCardContainer: {
    borderRadius: 20,
  },
  goalsContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.lg,
  },
  goalItem: {
    gap: Spacing.xs,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  goalProgress: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalsSummary: {
    padding: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalsSummaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  goalsSummaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Dropdown styles
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  menuContainer: {
    position: 'absolute',
    borderRadius: 16,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 2,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
  },
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
