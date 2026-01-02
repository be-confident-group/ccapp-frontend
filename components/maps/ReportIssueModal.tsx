import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/outline';
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
  const [selectedCategory, setSelectedCategory] = useState<MapFeedbackCategory>('road_damage');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const createFeedbackMutation = useCreateMapFeedback();

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Title Required', 'Please enter a title for your report.');
      return;
    }

    if (!coordinates) {
      Alert.alert('Error', 'Location data is missing.');
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

      Alert.alert('Success', 'Your report has been submitted. Thank you!', [
        {
          text: 'OK',
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
      Alert.alert('Error', 'Failed to submit your report. Please try again.');
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Report Issue</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <XMarkIcon size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Category</Text>
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
                      {cat.label}
                    </Text>
                    <Text
                      style={[styles.categoryDescription, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {cat.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Large pothole on Main Street"
                maxLength={100}
              />
            </View>

            {/* Description Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Provide additional details..."
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
                  Location
                </Text>
                <Text style={[styles.locationText, { color: colors.text }]}>
                  {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Submit Button */}
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Button
              title="Submit Report"
              onPress={handleSubmit}
              variant="primary"
              size="large"
              fullWidth
              loading={createFeedbackMutation.isPending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    minHeight: 500, // Ensure minimum height for content
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
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
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
