import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ArrowsPointingOutIcon,
  BeakerIcon,
  BellIcon,
  ChevronDownIcon,
  CloudIcon,
  FireIcon,
  TrophyIcon
} from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const [isTrackingActive, setIsTrackingActive] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleRef = useRef<any>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number; width: number }>({ x: 0, y: 0, width: 0 });

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
            Today, 28 October
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
                  setIsTrackingActive(true);
                  setIsMenuOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#EF4444' }, styles.iconShadow]}>
                  <MaterialIcons name="directions-run" size={18} color="#fff" />
                </View>
                <View style={styles.menuTextCol}>
                  <ThemedText style={styles.menuTitle}>Tracking on</ThemedText>
                  <ThemedText style={[styles.menuSubtitle, { color: colors.textSecondary }]}>Rides & walks • until you turn it off</ThemedText>
                </View>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsTrackingActive(false);
                  setIsMenuOpen(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.menuIcon, { backgroundColor: '#9CA3AF' }, styles.iconShadow]}>
                  <Ionicons name="man" size={18} color="#fff" />
                </View>
                <View style={styles.menuTextCol}>
                  <ThemedText style={styles.menuTitle}>Tracking off</ThemedText>
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
          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            {/* Background Tracking Toggle */}
            <TouchableOpacity
              ref={toggleRef}
              style={[styles.trackingToggle, { backgroundColor: colors.card }, styles.buttonShadow]}
              onPress={openMenu}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isTrackingActive ? ['#FFA7A7', '#EF4444', '#B91C1C'] : ['#F3F4F6', '#9CA3AF', '#6B7280']}
                start={{ x: 0.1, y: 0.05 }}
                end={{ x: 0.9, y: 1 }}
                style={[styles.trackingIcon, styles.iconShadow]}
              >
                {isTrackingActive ? (
                  <MaterialIcons name="directions-run" size={16} color="#FFFFFF" />
                ) : (
                  <Ionicons name="man" size={16} color="#FFFFFF" />
                )}
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 0.8 }}
                  style={styles.iconHighlight}
                />
              </LinearGradient>
              <View style={styles.trackingTextContainer}>
                <ThemedText style={styles.trackingTitle}>
                  {isTrackingActive ? 'Tracking on' : 'Tracking off'}
                </ThemedText>
                <ThemedText style={[styles.trackingSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  Rides & walks
                </ThemedText>
              </View>
              <ChevronDownIcon size={20} color={colors.icon} />
            </TouchableOpacity>

            {/* Weather Display */}
            <View style={[styles.weatherButton, { backgroundColor: colors.card }, styles.buttonShadow]}>
              <LinearGradient
                colors={['#E0F2FE', '#BAE6FD', '#7DD3FC']}
                start={{ x: 0.1, y: 0.1 }}
                end={{ x: 0.9, y: 0.9 }}
                style={[styles.weatherIconWrapper, styles.iconShadow]}
              >
                <CloudIcon size={16} color="#0284C7" />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 0.8 }}
                  style={styles.iconHighlight}
                />
              </LinearGradient>
              <View style={styles.weatherTextContainer}>
                <ThemedText style={styles.weatherTemp}>10°C</ThemedText>
                <ThemedText style={[styles.weatherLocation, { color: colors.textSecondary }]}>
                  London
                </ThemedText>
              </View>
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
                  <View style={[styles.statIconWrapper, { backgroundColor: '#FEF3C7' }, styles.statIconShadow]}>
                    <TrophyIcon size={20} color="#F59E0B" />
                  </View>
                  <ThemedText style={styles.statValue}>125.5</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>km walked</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={[styles.statIconWrapper, { backgroundColor: '#DBEAFE' }, styles.statIconShadow]}>
                    <FireIcon size={20} color="#3B82F6" />
                  </View>
                  <ThemedText style={styles.statValue}>42.3</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>km ride</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={[styles.statIconWrapper, { backgroundColor: '#DCFCE7' }, styles.statIconShadow]}>
                    <FireIcon size={20} color="#10B981" />
                  </View>
                  <ThemedText style={styles.statValue}>42</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>rides</ThemedText>
                </View>

                <View style={[styles.statDivider, { borderColor: colors.border }]} />

                <View style={styles.statItem}>
                  <View style={[styles.statIconWrapper, { backgroundColor: '#E0E7FF' }, styles.statIconShadow]}>
                    <BeakerIcon size={20} color="#6366F1" />
                  </View>
                  <ThemedText style={styles.statValue}>15.2</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>kg CO₂</ThemedText>
                </View>
              </View>

              {/* Divider between sections */}
              <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

              {/* Summary Section */}
              <View style={styles.summarySection}>
                <View style={styles.summaryHeader}>
                  <FireIcon size={18} color="#F59E0B" />
                  <ThemedText style={styles.summaryTitle}>Great progress this week!</ThemedText>
                </View>
                <ThemedText style={[styles.summaryText, { color: colors.textSecondary }]}>
                  You've walked 125.5km and rode 42.3km this week, saving 15.2kg of CO₂. Your recent 8km evening ride brought you closer to your weekly goal. Keep up the amazing work!
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
                    <ThemedText style={styles.streakTitle}>You are on 1 day streak!</ThemedText>
                  </View>
                  <ThemedText style={[styles.callToAction, { color: colors.textSecondary }]}>
                    Keep moving! Every journey counts. 🚴
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
                    { id: 1, icon: <TrophyIcon size={28} color="#F59E0B" />, title: 'First Ride', earned: true, bg: '#FEF3C7' },
                    { id: 2, icon: <FireIcon size={28} color="#10B981" />, title: 'First Walk', earned: true, bg: '#DCFCE7' },
                    { id: 3, icon: <TrophyIcon size={28} color="#3B82F6" />, title: '10 Rides', earned: true, bg: '#DBEAFE' },
                    { id: 4, icon: <FireIcon size={28} color="#8B5CF6" />, title: '10 Walks', earned: false, bg: '#E0E7FF' },
                    { id: 5, icon: <TrophyIcon size={28} color="#EF4444" />, title: '100 Rides', earned: false, bg: '#FEE2E2' },
                    { id: 6, icon: <BeakerIcon size={28} color="#F59E0B" />, title: '10 km', earned: true, bg: '#FEF3C7' },
                    { id: 7, icon: <BeakerIcon size={28} color="#10B981" />, title: '50 km', earned: true, bg: '#DCFCE7' },
                    { id: 8, icon: <BeakerIcon size={28} color="#3B82F6" />, title: '100 km', earned: false, bg: '#DBEAFE' },
                  ].map((trophy) => (
                    <TouchableOpacity
                      key={trophy.id}
                      style={[
                        styles.trophyItem,
                        { opacity: trophy.earned ? 1 : 0.4 }
                      ]}
                      onPress={() => router.push(`/home/badge-detail?id=${trophy.id}`)}
                    >
                      <View style={[styles.trophyIconWrapper, { backgroundColor: trophy.bg }]}>
                        {trophy.icon}
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
                    { id: 1, title: 'Ride 50km this week', current: 32, target: 50, color: '#3B82F6', bg: '#DBEAFE' },
                    { id: 2, title: 'Walk 5 times this week', current: 3, target: 5, color: '#10B981', bg: '#DCFCE7' },
                    { id: 3, title: 'Save 10kg CO₂ this month', current: 7.5, target: 10, color: '#F59E0B', bg: '#FEF3C7' },
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
  controlsContainer: {
    flexDirection: 'row',
    paddingTop: Spacing.md,
    paddingBottom: 0,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  trackingToggle: {
    flex: 7,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 18,
    gap: 14,
  },
  trackingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  trackingTextContainer: {
    flex: 1,
  },
  trackingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  trackingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  weatherButton: {
    flexDirection: 'row',
    flex: 3,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 18,
    gap: 10,
  },
  weatherIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
  weatherTextContainer: {
    alignItems: 'flex-start',
  },
  weatherTemp: {
    fontSize: 14,
    fontWeight: '600',
  },
  weatherLocation: {
    fontSize: 11,
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
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
});
