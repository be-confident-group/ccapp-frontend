import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TrophiesScreen() {
  const { colors } = useTheme();

  const trophies = [
    { id: 1, title: '2-fast streak', earned: true },
    { id: 2, title: '5-fast streak', earned: true },
    { id: 3, title: '10-fast streak', earned: false },
    { id: 4, title: '25-fast streak', earned: false },
    { id: 5, title: '50-fast streak', earned: false },
    { id: 6, title: '100-fast streak', earned: false },
    { id: 7, title: '250-fast streak', earned: false },
    { id: 8, title: '500-fast streak', earned: false },
    { id: 9, title: '1000-fast streak', earned: false },
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
                  {/* Trophy Icon */}
                  <View style={styles.trophyContainer}>
                    <Image
                      source={require('@/assets/images/page-icons/trophy.png')}
                      style={styles.trophyIcon}
                    />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyIcon: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  trophyTitle: {
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
});

