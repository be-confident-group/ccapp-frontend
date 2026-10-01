import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useTheme } from '@/contexts/ThemeContext';
import { TextInput, Button } from '@/components/ui';
import { useCreateMapFeedback } from '@/lib/hooks/useMapFeedback';
import type { MapFeedbackCategory, GeoJSONPoint } from '@/lib/api/mapFeedback';

interface CategoryOption {
  value: MapFeedbackCategory;
  label: string;
  description: string;
  icon: string;
}

const categories: CategoryOption[] = [
  { value: 'road_damage', label: 'Road Damage', description: 'Potholes, cracks, debris', icon: '🕳️' },
  { value: 'traffic_light', label: 'Traffic Light', description: 'Signal issues', icon: '🚦' },
  { value: 'safety_issue', label: 'Safety Issue', description: 'Dangerous conditions', icon: '⚠️' },
  { value: 'other', label: 'Other', description: 'Other issues', icon: '📍' },
];

interface ReportIssueModalProps {
  visible: boolean;
  coordinates: { latitude: number; longitude: number } | null;
  onClose: () => void;
}

export function ReportIssueModal({ visible, coordinates, onClose }: ReportIssueModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<MapFeedbackCategory>('road_damage');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createFeedbackMutation = useCreateMapFeedback();

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(t('maps:reportIssue.titleRequired', 'Title Required'), t('maps:reportIssue.titleRequiredMessage', 'Please enter a title for your report.'));
      return;
    }

    if (!coordinates) {
      Alert.alert(t('maps:reportIssue.errorTitle', 'Error'), t('maps:reportIssue.locationMissing', 'Location data is missing.'));
      return;
    }

    try {
      // Convert coordinates to GeoJSON Point format
      const geoJSONCoordinates: GeoJSONPoint = {
        type: 'Point',
        coordinates: [coordinates.longitude, coordinates.latitude],
      };

      await createFeedbackMutation.mutateAsync({
        type: 'point',
        category: selectedCategory,
        coordinates: geoJSONCoordinates,
        title: title.trim(),
        description: description.trim(),
      });

      Alert.alert(t('maps:reportIssue.successTitle', 'Success'), t('maps:reportIssue.successMessage', 'Your report has been submitted. Thank you!'), [
        {
          text: t('maps:reportIssue.ok', 'OK'),
          onPress: () => {
            // Reset form
            setTitle('');
            setDescription('');
            setSelectedCategory('road_damage');
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert(t('maps:reportIssue.errorTitle', 'Error'), t('maps:reportIssue.submitFailed', 'Failed to submit your report. Please try again.'));
    }
  };

  const handleClose = () => {
    // Reset form
    setTitle('');
    setDescription('');
    setSelectedCategory('road_damage');
    onClose();
  };

  return (
    <GlassSheet
      visible={visible}
      onClose={handleClose}
      title={t('maps:reportIssue.title', 'Report Issue')}
      footer={
        <Button
          title={t('maps:reportIssue.submit', 'Submit Report')}
          onPress={handleSubmit}
          variant="primary"
          size="large"
          fullWidth
          loading={createFeedbackMutation.isPending}
        />
      }
    >
      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('maps:reportIssue.category', 'Category')}
        </Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              onPress={() => setSelectedCategory(cat.value)}
              style={[
                styles.categoryButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                selectedCategory === cat.value && {
                  backgroundColor: colors.primary + '20',
                  borderColor: colors.primary,
                  borderWidth: 2,
                },
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text style={[styles.categoryLabel, { color: colors.text }]}>
                {t(`maps:reportIssue.categories.${cat.value}.label`, cat.label)}
              </Text>
              <Text
                style={[styles.categoryDescription, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {t(`maps:reportIssue.categories.${cat.value}.description`, cat.description)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Title Input */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('maps:reportIssue.titleLabel', 'Title')}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t('maps:reportIssue.titlePlaceholder', 'e.g., Large pothole on Main Street')}
          maxLength={100}
        />
      </View>

      {/* Description Input */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t('maps:reportIssue.descriptionLabel', 'Description (Optional)')}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('maps:reportIssue.descriptionPlaceholder', 'Provide additional details...')}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.descriptionInput}
          maxLength={500}
        />
      </View>

      {/* Location Info */}
      {coordinates && (
        <View style={[styles.locationInfo, { backgroundColor: colors.card }]}>
          <Text style={[styles.locationLabel, { color: colors.textSecondary }]}>
            {t('maps:reportIssue.location', 'Location')}
          </Text>
          <Text style={[styles.locationText, { color: colors.text }]}>
            {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
          </Text>
        </View>
      )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryButton: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  descriptionInput: {
    minHeight: 100,
  },
  locationInfo: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
