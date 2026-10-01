import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import { GlassTextSegments } from '@/components/ui/GlassTextSegments';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { SettingsScreen, SettingsFootnote } from '@/components/settings/SettingsScreen';
import { useSubmitFeedback } from '@/lib/hooks/useFeedback';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import type { FeedbackCategory } from '@/lib/api/feedback';

interface Attachment {
  uri: string; // Local URI for display
  base64?: string; // Base64 data for upload
}

export default function FeedbackScreen() {
  const { t } = useTranslation('feedback');
  const { colors } = useTheme();
  const categories: { key: FeedbackCategory; label: string; description: string }[] = [
    {
      key: 'bug',
      label: t('categories.bugReportShort', { defaultValue: 'Bug' }),
      description: t('categories.bugReportDescription', { defaultValue: 'Report a bug or issue' }),
    },
    {
      key: 'feature',
      label: t('categories.featureRequestShort', { defaultValue: 'Idea' }),
      description: t('categories.featureRequestDescription', { defaultValue: 'Suggest a new feature' }),
    },
    {
      key: 'general',
      label: t('categories.generalFeedbackShort', { defaultValue: 'General' }),
      description: t('categories.generalFeedbackDescription', { defaultValue: 'Share your thoughts' }),
    },
  ];
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const submitFeedbackMutation = useSubmitFeedback();
  const { data: currentUser } = useCurrentUser();

  const handlePickImage = async () => {
    try {
      // Limit to 3 attachments
      if (attachments.length >= 3) {
        Alert.alert(t('attachments.limitTitle', { defaultValue: 'Limit Reached' }), t('attachments.limitMessage', { defaultValue: 'You can attach up to 3 images.' }));
        return;
      }

      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          t('attachments.permissionTitle', { defaultValue: 'Permission Required' }),
          t('attachments.permissionMessage', { defaultValue: 'Please grant photo library permissions to attach images.' })
        );
        return;
      }

      // Launch image picker with base64 enabled
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
        base64: true, // Get base64 data
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;

        // Validate file type (PNG or JPG)
        if (!uri.toLowerCase().match(/\.(png|jpg|jpeg)$/)) {
          Alert.alert(t('attachments.invalidTypeTitle', { defaultValue: 'Invalid File Type' }), t('attachments.invalidTypeMessage', { defaultValue: 'Please select a PNG or JPG image.' }));
          return;
        }

        // Create base64 data URI if base64 is available
        let base64Data: string | undefined;
        if (asset.base64) {
          const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          base64Data = `data:${mimeType};base64,${asset.base64}`;
        }

        setAttachments([...attachments, { uri, base64: base64Data }]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('error.title', { defaultValue: 'Error' }), t('attachments.pickError', { defaultValue: 'Failed to pick image. Please try again.' }));
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(t('validation.messageRequiredTitle', { defaultValue: 'Message Required' }), t('validation.messageRequiredMessage', { defaultValue: 'Please enter your feedback message.' }));
      return;
    }

    try {
      // Collect device and app metadata
      const metadata = {
        appVersion: Constants.expoConfig?.version || '1.0.0',
        platform: Platform.OS,
        platformVersion: String(Platform.Version),
        deviceName: Constants.deviceName || 'Unknown',
        expoVersion: Constants.expoVersion || 'Unknown',
        ...(Platform.OS === 'ios' && Platform.constants && {
          systemName: (Platform.constants as any).systemName,
          osVersion: (Platform.constants as any).osVersion,
        }),
        ...(Platform.OS === 'android' && {
          androidApiLevel: Platform.Version,
        }),
      };

      // Get the first attachment's base64 data if available (backend only supports one photo)
      const photo = attachments.length > 0 && attachments[0].base64
        ? attachments[0].base64
        : null;

      await submitFeedbackMutation.mutateAsync({
        subject: subject.trim() || null,
        text: message.trim(),
        category,
        email: currentUser?.email || null,
        metadata,
        photo,
      });

      Alert.alert(
        t('success.title', { defaultValue: 'Thank You!' }),
        t('success.message', { defaultValue: 'Your feedback has been submitted successfully. We appreciate your input!' }),
        [
          {
            text: t('success.ok', { defaultValue: 'OK' }),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert(
        t('error.title', { defaultValue: 'Error' }),
        t('error.message', { defaultValue: 'Failed to submit feedback. Please try again.' }),
        [{ text: t('success.ok', { defaultValue: 'OK' }) }]
      );
    }
  };

  const selectedCategory = categories.find((cat) => cat.key === category);
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text },
  ];

  return (
    <SettingsScreen title={t('title', { defaultValue: 'Send Feedback' })} keyboardAvoiding>
      <SettingsGroup title={t('categories.label', { defaultValue: 'Category' })}>
        <View style={styles.cardBody}>
          <GlassTextSegments
            items={categories.map((c) => ({ key: c.key, label: c.label }))}
            value={category}
            onChange={setCategory}
            stretch
            fontSize={13}
          />
          <Text style={[styles.categoryDescription, { color: colors.textSecondary }]}>
            {selectedCategory?.description}
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup index={1} title={t('subject.label', { defaultValue: 'Subject (Optional)' })}>
        <View style={styles.cardBody}>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder={t('subject.placeholder', { defaultValue: 'Brief summary of your feedback' })}
            placeholderTextColor={colors.textSecondary}
            style={inputStyle}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup index={2} title={t('message.label', { defaultValue: 'Message' })}>
        <View style={styles.cardBody}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('message.placeholder', { defaultValue: "Tell us what's on your mind..." })}
            placeholderTextColor={colors.textSecondary}
            multiline
            textAlignVertical="top"
            style={[inputStyle, styles.messageInput]}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup
        index={3}
        title={t('attachments.label', { defaultValue: 'Attachments (Optional)' })}
      >
        <View style={styles.cardBody}>
          {attachments.length > 0 && (
            <View style={styles.attachmentList}>
              {attachments.map((attachment, index) => (
                <View
                  key={index}
                  style={[styles.attachmentItem, { backgroundColor: colors.inputBackground }]}
                >
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(index)}
                    accessibilityRole="button"
                    accessibilityLabel={t('attachments.remove', { defaultValue: 'Remove image' })}
                    style={[styles.removeButton, { backgroundColor: colors.error }]}
                  >
                    <XMarkIcon size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {attachments.length < 3 && (
            <TouchableOpacity
              onPress={handlePickImage}
              style={[
                styles.attachButton,
                { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder },
              ]}
              activeOpacity={0.7}
            >
              <PhotoIcon size={22} color={colors.textSecondary} />
              <Text style={[styles.attachButtonText, { color: colors.textSecondary }]}>
                {t('attachments.add', { defaultValue: 'Add Image' })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SettingsGroup>
      <SettingsFootnote>
        {t('attachments.hint', { defaultValue: 'You can attach up to 3 images (PNG or JPG only)' })}
      </SettingsFootnote>

      <View style={styles.submit}>
        <Button
          title={t('submit', { defaultValue: 'Submit Feedback' })}
          onPress={handleSubmit}
          variant="primary"
          size="large"
          fullWidth
          loading={submitFeedbackMutation.isPending}
        />
      </View>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  cardBody: { padding: 16, gap: 12 },
  categoryDescription: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  messageInput: { minHeight: 160, maxHeight: 300 },
  attachmentList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachmentItem: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachmentImage: { width: '100%', height: '100%', resizeMode: 'cover' },
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
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
  },
  attachButtonText: { fontSize: 15, fontWeight: '500' },
  submit: { paddingHorizontal: 16 },
});
