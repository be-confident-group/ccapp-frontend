import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { router, useFocusEffect } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image, ActivityIndicator } from 'react-native';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { trophyAPI, type Trophy } from '@/lib/api/trophies';
import { TrophyDetailsModal } from '@/components/modals/TrophyDetailsModal';

export default function TrophiesScreen() {
  const { colors } = useTheme();
  const [trophies, setTrophies] = useState<Trophy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTrophyModalOpen, setIsTrophyModalOpen] = useState(false);
  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null);

  const loadTrophies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedTrophies = await trophyAPI.getTrophies();
      setTrophies(fetchedTrophies);
    } catch (err) {
      console.error('[TrophiesScreen] Error loading trophies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trophies');
      // Fallback to cached trophies if available
      const cached = await trophyAPI.getCachedTrophies();
      if (cached) {
        setTrophies(cached);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh trophies when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTrophies();
    }, [loadTrophies])
  );

  const handleTrophyPress = (trophy: Trophy) => {
    setSelectedTrophy(trophy);
    setIsTrophyModalOpen(true);
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
          {/* Loading State */}
          {loading && trophies.length === 0 && (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText style={styles.loadingText}>Loading trophies...</ThemedText>
            </View>
          )}

          {/* Error State */}
          {error && !loading && trophies.length === 0 && (
            <View style={styles.centerContainer}>
              <ThemedText style={styles.errorText}>Failed to load trophies</ThemedText>
              <ThemedText style={[styles.errorSubtext, { color: colors.textSecondary }]}>{error}</ThemedText>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={loadTrophies}
              >
                <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty State - No trophies available */}
          {!loading && !error && trophies.length === 0 && (
            <View style={styles.centerContainer}>
              <ThemedText style={styles.emptyTitle}>No trophies available</ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Trophies will appear here once they are configured. Start riding and walking to earn them!
              </ThemedText>
            </View>
          )}

          {/* Trophies Grid */}
          {!loading && trophies.length > 0 && (
            <View style={styles.trophiesGrid}>
                {trophies.map((trophy) => (
                  <TouchableOpacity
                    key={trophy.code}
                    style={styles.trophyWrapper}
                    onPress={() => handleTrophyPress(trophy)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.trophyCard}>
                      {/* Trophy Icon */}
                      <View style={styles.trophyContainer}>
                        <Image
                          source={require('@/assets/images/page-icons/trophy.png')}
                          style={[
                            styles.trophyImage,
                            { opacity: trophy.is_earned ? 1 : 0.4 }
                          ]}
                        />
                      </View>

                      {/* Trophy Title */}
                      <ThemedText
                        style={[
                          styles.trophyTitle,
                          { color: trophy.is_earned ? colors.text : colors.textSecondary }
                        ]}
                        numberOfLines={2}
                      >
                        {trophy.name}
                      </ThemedText>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </ScrollView>

        {/* Trophy Details Modal */}
        <TrophyDetailsModal
          visible={isTrophyModalOpen}
          onClose={() => setIsTrophyModalOpen(false)}
          trophy={selectedTrophy}
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 20,
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
  trophyImage: {
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

