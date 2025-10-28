import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronLeftIcon, TrophyIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrophiesScreen() {
  const { colors } = useTheme();

  const trophies = [
    { id: 1, number: '2', title: '2-fast streak', earned: true, color: '#F59E0B', bg: '#FEF3C7' },
    { id: 2, number: '5', title: '5-fast streak', earned: true, color: '#10B981', bg: '#DCFCE7' },
    { id: 3, number: '10', title: '10-fast streak', earned: false, color: '#3B82F6', bg: '#DBEAFE' },
    { id: 4, number: '25', title: '25-fast streak', earned: false, color: '#8B5CF6', bg: '#E0E7FF' },
    { id: 5, number: '50', title: '50-fast streak', earned: false, color: '#EF4444', bg: '#FEE2E2' },
    { id: 6, number: '100', title: '100-fast streak', earned: false, color: '#F59E0B', bg: '#FEF3C7' },
    { id: 7, number: '250', title: '250-fast streak', earned: false, color: '#10B981', bg: '#DCFCE7' },
    { id: 8, number: '500', title: '500-fast streak', earned: false, color: '#3B82F6', bg: '#DBEAFE' },
    { id: 9, number: '1000', title: '1000-fast streak', earned: false, color: '#8B5CF6', bg: '#E0E7FF' },
  ];

  const handleTrophyPress = (trophyId: number) => {
    router.push(`/home/badge-detail?id=${trophyId}`);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>
          
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Trophies Case
          </ThemedText>
          
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Trophies Grid */}
          <View style={styles.trophiesGrid}>
            {trophies.map((trophy) => (
              <TouchableOpacity
                key={trophy.id}
                style={styles.trophyWrapper}
                onPress={() => handleTrophyPress(trophy.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.trophyCard, { opacity: trophy.earned ? 1 : 0.4 }]}>
                  {/* Trophy Badge */}
                  <View style={[styles.trophyContainer, { backgroundColor: trophy.bg }]}>
                    <View style={styles.trophyCircle}>
                      <ThemedText style={[styles.trophyNumber, { color: trophy.earned ? trophy.color : '#9CA3AF' }]}>
                        {trophy.number}
                      </ThemedText>
                    </View>
                    {/* Trophy Icon at bottom */}
                    <View style={styles.trophyIconContainer}>
                      <TrophyIcon size={32} color={trophy.earned ? trophy.color : '#9CA3AF'} />
                    </View>
                  </View>
                  
                  {/* Trophy Title */}
                  <ThemedText style={[styles.trophyTitle, { color: trophy.earned ? colors.text : colors.textSecondary }]} numberOfLines={1}>
                    {trophy.title}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  trophiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  trophyWrapper: {
    width: '30%',
    marginBottom: Spacing.lg,
  },
  trophyCard: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  trophyContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  trophyCircle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  trophyIconContainer: {
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyTitle: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});

