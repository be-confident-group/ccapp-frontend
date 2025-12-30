/**
 * UnratedTripCard Component
 *
 * A card component for displaying unrated trips in the list.
 * Shows trip type, date, distance, and a "Rate Now" action.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { Spacing } from '@/constants/theme';
import { getTripTypeColor, getTripTypeIcon, getTripTypeName } from '@/types/trip';
import { formatDistance } from '@/lib/utils/geoCalculations';
import type { Trip } from '@/lib/database';

interface UnratedTripCardProps {
  trip: Trip;
  onPress: () => void;
  style?: ViewStyle;
}

export default function UnratedTripCard({
  trip,
  onPress,
  style,
}: UnratedTripCardProps) {
  const { colors } = useTheme();
  const { unitSystem } = useUnits();

  const tripColor = getTripTypeColor(trip.type);
  const tripIcon = getTripTypeIcon(trip.type);
  const tripName = getTripTypeName(trip.type);
  const date = new Date(trip.start_time);

  // Format date
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Trip Type Icon */}
      <View style={[styles.iconContainer, { backgroundColor: tripColor + '20' }]}>
        <MaterialCommunityIcons
          name={tripIcon as any}
          size={28}
          color={tripColor}
        />
      </View>

      {/* Trip Details */}
      <View style={styles.details}>
        <ThemedText style={styles.tripName}>{tripName}</ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
            {formattedDate}
          </ThemedText>
          <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
          <ThemedText style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatDistance(trip.distance, unitSystem)}
          </ThemedText>
        </View>
      </View>

      {/* Rate Now Action */}
      <View style={styles.action}>
        <ThemedText style={[styles.actionText, { color: colors.accent }]}>
          Rate
        </ThemedText>
        <ChevronRightIcon size={18} color={colors.accent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  details: {
    flex: 1,
  },
  tripName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
