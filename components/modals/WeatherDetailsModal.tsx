import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Dimensions, Text } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { XMarkIcon } from 'react-native-heroicons/outline';
import type { WeatherData } from '@/lib/services/WeatherService';
import { Spacing } from '@/constants/theme';

interface WeatherDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  weather: WeatherData | null;
}

const { width } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(width - 48, 400);

export function WeatherDetailsModal({ visible, onClose, weather }: WeatherDetailsModalProps) {
  const { colors, isDark } = useTheme();
  const { formatTemperature } = useUnits();

  if (!weather) return null;

  const weatherIconName = (weather.icon as keyof typeof MaterialCommunityIcons.glyphMap) ?? 'weather-partly-cloudy';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <XMarkIcon size={24} color={colors.icon} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
                  <MaterialCommunityIcons name={weatherIconName} size={64} color="#0284C7" />
                </View>
                <Text style={[styles.temperature, { color: colors.text }]}>
                  {weather.temperature}°C
                </Text>
                <ThemedText style={styles.condition}>{weather.condition}</ThemedText>
                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                  {weather.description}
                </ThemedText>
                <ThemedText style={[styles.city, { color: colors.textSecondary }]}>
                  {weather.city}
                </ThemedText>
              </View>

              {/* Divider */}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {/* Weather Details Grid */}
              <View style={styles.detailsGrid}>
                {/* Feels Like */}
                <View style={styles.detailItem}>
                  <View style={[styles.detailIconContainer, { backgroundColor: '#FEF3C7' }]}>
                    <MaterialCommunityIcons name="thermometer" size={24} color="#F59E0B" />
                  </View>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Feels Like
                  </ThemedText>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {weather.feelsLike}°C
                  </Text>
                </View>

                {/* Humidity */}
                <View style={styles.detailItem}>
                  <View style={[styles.detailIconContainer, { backgroundColor: '#DBEAFE' }]}>
                    <MaterialCommunityIcons name="water-percent" size={24} color="#3B82F6" />
                  </View>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Humidity
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {weather.humidity}%
                  </ThemedText>
                </View>

                {/* Wind Speed */}
                <View style={styles.detailItem}>
                  <View style={[styles.detailIconContainer, { backgroundColor: '#DCFCE7' }]}>
                    <MaterialCommunityIcons name="weather-windy" size={24} color="#10B981" />
                  </View>
                  <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    Wind Speed
                  </ThemedText>
                  <ThemedText style={styles.detailValue}>
                    {weather.windSpeed} km/h
                  </ThemedText>
                </View>
              </View>

              {/* Last Updated */}
              <View style={styles.footer}>
                <ThemedText style={[styles.lastUpdated, { color: colors.textSecondary }]}>
                  Last updated: {new Date(weather.timestamp).toLocaleTimeString()}
                </ThemedText>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    borderRadius: 24,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  temperature: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  condition: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  city: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detailIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  lastUpdated: {
    fontSize: 12,
  },
});
