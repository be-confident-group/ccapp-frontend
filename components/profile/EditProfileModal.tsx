import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronDownIcon, CalendarIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { TextInput, Button } from '@/components/ui';
import { GlassSheet } from '@/components/ui/GlassSheet';
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
  const { colors } = useTheme();
  const { t } = useTranslation('profile');

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
    <GlassSheet
      visible={visible}
      onClose={onClose}
      title={t('edit.title')}
      footer={
        <Button
          title={saving ? t('edit.saving') : t('edit.save')}
          onPress={handleSave}
          size="large"
          fullWidth
          loading={saving}
          disabled={saving}
        />
      }
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
            onPress={() => {
              setShowGenderPicker(false);
              setShowDatePicker((open) => (Platform.OS === 'ios' ? !open : true));
            }}
            style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
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

          {/* Inline spinner for iOS */}
          {Platform.OS === 'ios' && showDatePicker && (
            <View style={[styles.inlinePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
                textColor={colors.text}
              />
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.inlineDone}>
                <Text style={[styles.pickerDone, { color: colors.primary }]}>{t('edit.done')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

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

        {/* Gender Picker */}
        <View>
          <Text style={[styles.label, { color: colors.text }]}>{t('edit.genderLabel')}</Text>
          <TouchableOpacity
            onPress={() => {
              setShowDatePicker(false);
              setShowGenderPicker((open) => !open);
            }}
            style={[styles.pickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
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

          {showGenderPicker && (
            <View style={[styles.inlinePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {GENDER_OPTIONS.map((option, index) => {
                const selected = formData.gender === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleGenderSelect(option.value)}
                    style={[
                      styles.pickerItem,
                      index < GENDER_OPTIONS.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        {
                          color: selected ? colors.primary : colors.text,
                          fontWeight: selected ? '600' : '400',
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
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
  inlinePanel: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  inlineDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerItem: {
    padding: 16,
  },
  pickerItemText: {
    fontSize: 16,
  },
});
