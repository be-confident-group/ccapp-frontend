import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BoltIcon,
  CloudIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
} from 'react-native-heroicons/solid';
import { ThemedText } from '@/components/themed-text';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useTheme } from '@/contexts/ThemeContext';
import type { WeatherData } from '@/lib/services/WeatherService';
import { Spacing } from '@/constants/theme';

interface WeatherDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  weather: WeatherData | null;
}

type IconType = React.ComponentType<{ size?: number; color?: string }>;

/** Map WeatherService icon names (MaterialCommunityIcons ids) to heroicons. */
function getWeatherIcon(name: string): IconType {
  if (name.includes('night')) return MoonIcon;
  if (name.includes('sunny')) return SunIcon;
  if (name.includes('lightning')) return BoltIcon;
  if (name.includes('snow')) return SparklesIcon;
  return CloudIcon;
}

export function WeatherDetailsModal({ visible, onClose, weather }: WeatherDetailsModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!weather) return null;

  const WeatherIcon = getWeatherIcon(weather.icon ?? '');

  return (
    <GlassSheet visible={visible} onClose={onClose}>
    {/* Header */}
    <View style={styles.header}>
      <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
        <WeatherIcon size={64} color="#0284C7" />
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
          <SunIcon size={24} color="#F59E0B" />
        </View>
        <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
          {t('common:weatherDetails.feelsLike', 'Feels Like')}
        </ThemedText>
        <Text style={[styles.detailValue, { color: colors.text }]}>
          {weather.feelsLike}°C
        </Text>
      </View>

      {/* Humidity */}
      <View style={styles.detailItem}>
        <View style={[styles.detailIconContainer, { backgroundColor: '#DBEAFE' }]}>
          <CloudIcon size={24} color="#3B82F6" />
        </View>
        <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
          {t('common:weatherDetails.humidity', 'Humidity')}
        </ThemedText>
        <ThemedText style={styles.detailValue}>
          {weather.humidity}%
        </ThemedText>
      </View>

      {/* Wind Speed */}
      <View style={styles.detailItem}>
        <View style={[styles.detailIconContainer, { backgroundColor: '#DCFCE7' }]}>
          <SparklesIcon size={24} color="#10B981" />
        </View>
        <ThemedText style={[styles.detailLabel, { color: colors.textSecondary }]}>
          {t('common:weatherDetails.windSpeed', 'Wind Speed')}
        </ThemedText>
        <ThemedText style={styles.detailValue}>
          {weather.windSpeed} km/h
        </ThemedText>
      </View>
    </View>

    {/* Last Updated */}
    <View style={styles.footer}>
      <ThemedText style={[styles.lastUpdated, { color: colors.textSecondary }]}>
        {t('common:weatherDetails.lastUpdated', { time: new Date(weather.timestamp).toLocaleTimeString(), defaultValue: 'Last updated: {{time}}' })}
      </ThemedText>
    </View>
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
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
