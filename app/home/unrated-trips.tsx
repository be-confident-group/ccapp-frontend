/**
 * Unrated Trips Screen
 *
 * Displays a list of trips that haven't been rated yet.
 * Users can select a trip to rate from this list.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeftIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { InformationCircleIcon } from 'react-native-heroicons/solid';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UnratedTripCard } from '@/components/rating';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { database, type Trip } from '@/lib/database';

export default function UnratedTripsScreen() {
  const { colors } = useTheme();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const loadTrips = useCallback(async () => {
    try {
      await database.init();
      const unratedTrips = await database.getUnratedTrips();
      setTrips(unratedTrips);
    } catch (error) {
      console.error('[UnratedTrips] Error loading trips:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load trips on mount
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrips();
    setRefreshing(false);
  };

  const handleTripPress = (trip: Trip) => {
    router.push(`/home/rate-route?id=${trip.id}`);
  };

  const renderTrip = ({ item }: { item: Trip }) => (
    <UnratedTripCard trip={item} onPress={() => handleTripPress(item)} />
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ThemedView style={styles.container}>
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ThemedView style={styles.container}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <ThemedText type="subtitle" style={styles.headerTitle}>
              Rate My Routes
            </ThemedText>
            {trips.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
                <ThemedText style={styles.countText}>{trips.length}</ThemedText>
              </View>
            )}
          </View>

          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        {trips.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={64}
              color={colors.primary}
            />
            <ThemedText style={styles.emptyTitle}>All caught up!</ThemedText>
            <ThemedText
              style={[styles.emptySubtext, { color: colors.textSecondary }]}
            >
              You've rated all your trips. New trips will appear here after
              you complete them.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={trips}
            renderItem={renderTrip}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              <ThemedText
                style={[styles.listHeader, { color: colors.textSecondary }]}
              >
                Select a trip to rate your experience
              </ThemedText>
            }
          />
        )}

        {/* Floating Info Button */}
        <TouchableOpacity
          style={[styles.floatingInfoButton, { backgroundColor: colors.card }]}
          onPress={() => setShowInfoModal(true)}
          activeOpacity={0.9}
        >
          <MaterialCommunityIcons name="help-circle-outline" size={20} color={colors.primary} />
          <ThemedText style={[styles.floatingInfoText, { color: colors.primary }]}>
            Why rate routes?
          </ThemedText>
        </TouchableOpacity>

        {/* Info Modal */}
        <Modal
          visible={showInfoModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowInfoModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowInfoModal(false)}
          >
            <Pressable
              style={[styles.modalCard, { backgroundColor: colors.card }]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowInfoModal(false)}
                activeOpacity={0.7}
              >
                <XMarkIcon size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.modalHeaderSection}>
                <View style={[styles.modalIconBadge, { backgroundColor: colors.accent + '20' }]}>
                  <MaterialCommunityIcons name="chart-line" size={28} color={colors.accent} />
                </View>
                <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                  Your Routes Build Better Cities
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Each rating you share becomes valuable data for urban planning
                </ThemedText>
              </View>

              {/* Benefits List */}
              <View style={styles.benefitsList}>
                <View style={styles.benefitItem}>
                  <View style={[styles.benefitDot, { backgroundColor: '#4CAF50' }]} />
                  <ThemedText style={[styles.benefitText, { color: colors.text }]}>
                    Spot dangerous intersections and roads that need attention
                  </ThemedText>
                </View>

                <View style={styles.benefitItem}>
                  <View style={[styles.benefitDot, { backgroundColor: '#2196F3' }]} />
                  <ThemedText style={[styles.benefitText, { color: colors.text }]}>
                    Help councils prioritize where to add bike lanes
                  </ThemedText>
                </View>

                <View style={styles.benefitItem}>
                  <View style={[styles.benefitDot, { backgroundColor: '#FF9800' }]} />
                  <ThemedText style={[styles.benefitText, { color: colors.text }]}>
                    Highlight the great routes so others can discover them
                  </ThemedText>
                </View>

                <View style={styles.benefitItem}>
                  <View style={[styles.benefitDot, { backgroundColor: '#9C27B0' }]} />
                  <ThemedText style={[styles.benefitText, { color: colors.text }]}>
                    All feedback is anonymized to protect your privacy
                  </ThemedText>
                </View>
              </View>

              {/* Footer */}
              <View style={[styles.modalFooterNote, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="lock-outline" size={16} color={colors.textSecondary} />
                <ThemedText style={[styles.footerNoteText, { color: colors.textSecondary }]}>
                  Your exact routes are never shared — only aggregated patterns
                </ThemedText>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: Spacing.lg,
  },
  listHeader: {
    fontSize: 14,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Floating Info Button
  floatingInfoButton: {
    position: 'absolute',
    bottom: Spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingInfoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modalHeaderSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  benefitsList: {
    gap: 14,
    marginBottom: Spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  modalFooterNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
