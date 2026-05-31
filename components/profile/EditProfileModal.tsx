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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { XMarkIcon, ChevronDownIcon, CalendarIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { TextInput } from '@/components/ui';
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
  onSave: (profile: UserProfile) => Promise<void>;
}

type GenderValue = 'M' | 'F' | 'O' | '';

const VALID_GENDER_VALUES: GenderValue[] = ['M', 'F', 'O', ''];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  profile,
  onSave,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation('profile');
  const insets = useSafeAreaInsets();

  const GENDER_OPTIONS: { value: GenderValue; label: string }[] = [
    { value: 'M', label: t('edit.genderMale') },
    { value: 'F', label: t('edit.genderFemale') },
    { value: 'O', label: t('edit.genderOther') },
    { value: '', label: t('edit.genderPreferNotToSay') },
  ];

  const [formData, setFormData] = useState<UserProfile>(profile);
  const [errors, setErrors] = useState<Partial<Record<keyof UserProfile, string>>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(
    profile.dateOfBirth ? new Date(profile.dateOfBirth) : new Date()
  );
  useEffect(() => {
    if (visible) {
      setFormData(profile);
      setErrors({});
      if (profile.dateOfBirth) {
        setSelectedDate(new Date(profile.dateOfBirth));
      }
    }
  }, [visible, profile]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof UserProfile, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t('edit.firstNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('edit.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('edit.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      try {
        setSaving(true);
        await onSave(formData);
        onClose();
      } catch (error) {
        console.error('Error saving profile:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleImageChange = (uri: string) => {
    setFormData({ ...formData, profilePicture: uri });
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (date) {
      setSelectedDate(date);
      const dateString = date.toISOString().split('T')[0];
      setFormData({ ...formData, dateOfBirth: dateString });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGenderLabel = (value?: string) => {
    return GENDER_OPTIONS.find((opt) => opt.value === value)?.label || t('edit.selectGender');
  };

  const handleGenderSelect = (value: string) => {
    if (!VALID_GENDER_VALUES.includes(value as GenderValue)) {
      console.warn(`EditProfileModal: invalid gender value received: "${value}"`);
      return;
    }
    setFormData({ ...formData, gender: value as GenderValue });
    setShowGenderPicker(false);
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
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton} disabled={saving}>
            <Text style={[styles.cancelText, { color: saving ? colors.textSecondary : colors.text }]}>{t('edit.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('edit.title')}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
            <Text style={[styles.saveText, { color: saving ? colors.textSecondary : colors.primary }]}>
              {saving ? t('edit.saving') : t('edit.save')}
            </Text>
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
              {t('edit.tapToChangePhoto')}
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <TextInput
              label={t('edit.firstNameLabel')}
              value={formData.firstName}
              onChangeText={(text) => setFormData({ ...formData, firstName: text })}
              error={errors.firstName}
              placeholder={t('edit.firstNamePlaceholder')}
            />

            <TextInput
              label={t('edit.lastNameLabel')}
              value={formData.lastName}
              onChangeText={(text) => setFormData({ ...formData, lastName: text })}
              error={errors.lastName}
              placeholder={t('edit.lastNamePlaceholder')}
            />

            <TextInput
              label={t('edit.emailLabel')}
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              error={errors.email}
              placeholder={t('edit.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Date of Birth Picker */}
            <View>
              <Text style={[styles.label, { color: colors.text }]}>{t('edit.dateOfBirthLabel')}</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[
                  styles.pickerButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <CalendarIcon size={20} color={colors.textSecondary} />
                <Text
                  style={[
                    styles.pickerText,
                    { color: formData.dateOfBirth ? colors.text : colors.textSecondary },
                  ]}
                >
                  {formatDate(formData.dateOfBirth) || t('edit.selectDateOfBirth')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Gender Picker */}
            <View>
              <Text style={[styles.label, { color: colors.text }]}>{t('edit.genderLabel')}</Text>
              <TouchableOpacity
                onPress={() => setShowGenderPicker(true)}
                style={[
                  styles.pickerButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.pickerText,
                    { color: formData.gender ? colors.text : colors.textSecondary },
                  ]}
                >
                  {getGenderLabel(formData.gender)}
                </Text>
                <ChevronDownIcon size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Date Picker Overlay for iOS */}
        {Platform.OS === 'ios' && showDatePicker && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            />
            <View style={[styles.pickerModal, { backgroundColor: colors.background }]}>
              <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={[styles.pickerDone, { color: colors.primary }]}>{t('edit.done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                textColor={colors.text}
              />
            </View>
          </View>
        )}

        {/* Date Picker for Android */}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        )}

        {/* Gender Picker Overlay */}
        {showGenderPicker && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowGenderPicker(false)}
            />
            <View style={[styles.pickerModal, { backgroundColor: colors.background }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>{t('edit.selectGenderTitle')}</Text>
              <TouchableOpacity onPress={() => setShowGenderPicker(false)}>
                <Text style={[styles.pickerDone, { color: colors.primary }]}>{t('edit.done')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleGenderSelect(option.value)}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    formData.gender === option.value && {
                      backgroundColor: colors.primary + '10',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      {
                        color:
                          formData.gender === option.value
                            ? colors.primary
                            : colors.text,
                        fontWeight: formData.gender === option.value ? '600' : '400',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        )}
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
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  cancelButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarHint: {
    marginTop: 6,
    fontSize: 13,
  },
  formSection: {
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
  },
});
