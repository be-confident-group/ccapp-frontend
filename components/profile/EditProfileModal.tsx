import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { TextInput } from '@/components/ui';
import { Button } from '@/components/ui';
import { ProfileAvatar } from './ProfileAvatar';

interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string;
  gender?: 'M' | 'F' | 'O' | '';
  profilePicture?: string;
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  profile,
  onSave,
}) => {
  const { colors, isDark } = useTheme();
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfile, string>>>({});

  useEffect(() => {
    if (visible) {
      setFormData(profile);
      setErrors({});
    }
  }, [visible, profile]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UserProfile, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    // Validate date of birth format (YYYY-MM-DD)
    if (formData.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(formData.dateOfBirth)) {
      newErrors.dateOfBirth = 'Invalid date format (use YYYY-MM-DD)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const handleImageChange = (uri: string) => {
    setFormData({ ...formData, profilePicture: uri });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <XMarkIcon size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Picture */}
          <View style={styles.avatarSection}>
            <ProfileAvatar
              imageUri={formData.profilePicture}
              firstName={formData.firstName}
              lastName={formData.lastName}
              onImageChange={handleImageChange}
              size={100}
              editable={true}
            />
            <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
              Tap to change photo
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <TextInput
              label="First Name"
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              error={errors.firstName}
              placeholder="Enter your first name"
            />

            <TextInput
              label="Last Name"
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              error={errors.lastName}
              placeholder="Enter your last name"
            />

            <TextInput
              label="Email"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              error={errors.email}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              label="Date of Birth"
              value={formData.dateOfBirth || ''}
              onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
              error={errors.dateOfBirth}
              placeholder="YYYY-MM-DD"
            />

            {/* Gender Selector */}
            <View style={styles.genderSection}>
              <Text style={[styles.genderLabel, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderButtons}>
                {[
                  { value: 'M', label: 'Male' },
                  { value: 'F', label: 'Female' },
                  { value: 'O', label: 'Other' },
                  { value: '', label: 'Prefer not to say' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setFormData({ ...formData, gender: option.value as any })}
                    style={[
                      styles.genderButton,
                      {
                        backgroundColor:
                          formData.gender === option.value
                            ? colors.primary + '20'
                            : colors.card,
                        borderColor:
                          formData.gender === option.value ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        {
                          color:
                            formData.gender === option.value
                              ? colors.primary
                              : colors.textSecondary,
                          fontWeight: formData.gender === option.value ? '600' : '400',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={onClose}
              variant="outline"
              size="large"
              style={styles.button}
            />
            <View style={styles.buttonSpacer} />
            <Button
              title="Save Changes"
              onPress={handleSave}
              variant="primary"
              size="large"
              style={styles.button}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 14,
  },
  formSection: {
    gap: 16,
  },
  genderSection: {
    marginTop: 8,
  },
  genderLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  genderButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genderButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  genderButtonText: {
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
  },
  buttonSpacer: {
    width: 12,
  },
});
