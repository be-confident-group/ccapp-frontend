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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
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
});
