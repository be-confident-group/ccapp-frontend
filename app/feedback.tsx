import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeftIcon,
  ChevronDownIcon,
  PhotoIcon,
  XMarkIcon,
} from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { TextInput } from '@/components/ui';
import { Button } from '@/components/ui';
import { useSubmitFeedback } from '@/lib/hooks/useFeedback';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { FeedbackCategory } from '@/lib/api/feedback';

interface CategoryOption {
  value: FeedbackCategory;
  label: string;
  description: string;
}

const categories: CategoryOption[] = [
  { value: 'bug', label: 'Bug Report', description: 'Report a bug or issue' },
  { value: 'feature', label: 'Feature Request', description: 'Suggest a new feature' },
  { value: 'general', label: 'General Feedback', description: 'Share your thoughts' },
];

export default function FeedbackScreen() {
  const { colors, isDark } = useTheme();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const submitFeedbackMutation = useSubmitFeedback();
  const { data: currentUser } = useCurrentUser();

  const handlePickImage = async () => {
    try {
      // Limit to 3 attachments
      if (attachments.length >= 3) {
        Alert.alert('Limit Reached', 'You can attach up to 3 images.');
        return;
      }

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library permissions to attach images.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;

        // Validate file type (PNG or JPG)
        if (!uri.toLowerCase().match(/\.(png|jpg|jpeg)$/)) {
          Alert.alert('Invalid File Type', 'Please select a PNG or JPG image.');
          return;
        }

        setAttachments([...attachments, uri]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Message Required', 'Please enter your feedback message.');
      return;
    }

    try {
      await submitFeedbackMutation.mutateAsync({
        text: message.trim(),
        category,
        email: currentUser?.email,
      });

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted successfully. We appreciate your input!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        'Error',
        'Failed to submit feedback. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const selectedCategory = categories.find((cat) => cat.value === category);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeftIcon size={24} color={colors.text} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Send Feedback</ThemedText>
          <View style={styles.headerRight} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Category Picker */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                style={[
                  styles.categoryButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.categoryContent}>
                  <Text style={[styles.categoryLabel, { color: colors.text }]}>
                    {selectedCategory?.label}
                  </Text>
                  <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>
                    {selectedCategory?.description}
                  </Text>
                </View>
                <ChevronDownIcon
                  size={20}
                  color={colors.textSecondary}
                  style={[
                    styles.chevron,
                    showCategoryPicker && styles.chevronRotated,
                  ]}
                />
              </TouchableOpacity>

              {/* Category Options */}
              {showCategoryPicker && (
                <View style={[styles.categoryOptions, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {categories.map((cat, index) => (
                    <TouchableOpacity
                      key={cat.value}
                      onPress={() => {
                        setCategory(cat.value);
                        setShowCategoryPicker(false);
                      }}
                      style={[
                        styles.categoryOption,
                        index < categories.length - 1 && [
                          styles.categoryOptionBorder,
                          { borderBottomColor: colors.border },
                        ],
                        category === cat.value && {
                          backgroundColor: colors.primary + '10',
                        },
                      ]}
                    >
                      <Text style={[styles.categoryLabel, { color: colors.text }]}>
                        {cat.label}
                      </Text>
                      <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>
                        {cat.description}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Message Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what's on your mind..."
                multiline
                numberOfLines={10}
                textAlignVertical="top"
                style={styles.messageTextInput}
              />
            </View>

            {/* Attachments */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>
                Attachments (Optional)
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                You can attach up to 3 images (PNG or JPG only)
              </Text>

              {/* Attachment List */}
              {attachments.length > 0 && (
                <View style={styles.attachmentList}>
                  {attachments.map((uri, index) => (
                    <View
                      key={index}
                      style={[styles.attachmentItem, { backgroundColor: colors.card }]}
                    >
                      <Image source={{ uri }} style={styles.attachmentImage} />
                      <TouchableOpacity
                        onPress={() => handleRemoveAttachment(index)}
                        style={[styles.removeButton, { backgroundColor: colors.error }]}
                      >
                        <XMarkIcon size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add Attachment Button */}
              {attachments.length < 3 && (
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={[
                    styles.attachButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  activeOpacity={0.7}
                >
                  <PhotoIcon size={24} color={colors.textSecondary} />
                  <Text style={[styles.attachButtonText, { color: colors.textSecondary }]}>
                    Add Image
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* Submit Button */}
          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Button
              title="Submit Feedback"
              onPress={handleSubmit}
              variant="primary"
              size="large"
              fullWidth
              loading={submitFeedbackMutation.isPending}
            />
          </View>
        </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  hint: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryContent: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 13,
  },
  chevron: {
    marginLeft: 8,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  categoryOptions: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryOption: {
    padding: 16,
  },
  categoryOptionBorder: {
    borderBottomWidth: 1,
  },
  messageTextInput: {
    minHeight: 200,
    maxHeight: 300,
    fontSize: 16,
    lineHeight: 24,
  },
  attachmentList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  attachmentItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  attachButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
