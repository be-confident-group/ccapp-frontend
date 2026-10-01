import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TextInput, Button } from '@/components/ui';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { authApi } from '@/lib/api/auth';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const { t } = useTranslation('profile');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!oldPassword) {
      newErrors.oldPassword = t('changePassword.currentPasswordRequired');
    }
    if (!newPassword) {
      newErrors.newPassword = t('changePassword.newPasswordRequired');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t('changePassword.newPasswordTooShort');
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = t('changePassword.confirmPasswordRequired');
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('changePassword.passwordsDoNotMatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      await authApi.changePassword({
        old_password: oldPassword,
        new_password: newPassword,
        new_password2: confirmPassword,
      });
      Alert.alert(t('changePassword.successTitle'), t('changePassword.successMessage'), [
        { text: t('changePassword.successOk'), onPress: handleClose },
      ]);
    } catch (error: any) {
      const raw = error?.message || t('changePassword.fallbackError');
      // API returns field-prefixed errors like "old_password: Wrong Password"
      // Strip the field prefix for a cleaner user-facing message
      const message = raw.replace(/^old_password:\s*/i, '')
                         .replace(/^new_password2?:\s*/i, '')
                         .replace(/^new_password:\s*/i, '');

      if (/wrong|incorrect|invalid.*password|old.password/i.test(raw)) {
        setErrors({ oldPassword: message });
      } else if (/new_password2|match|confirm/i.test(raw)) {
        setErrors({ confirmPassword: message });
      } else if (/new_password/i.test(raw)) {
        setErrors({ newPassword: message });
      } else {
        setErrors({ oldPassword: message });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassSheet
      visible={visible}
      onClose={handleClose}
      title={t('changePassword.title')}
      footer={
        <Button
          title={saving ? t('changePassword.saving') : t('changePassword.save')}
          onPress={handleSave}
          size="large"
          fullWidth
          loading={saving}
          disabled={saving}
        />
      }
    >
      <View style={styles.formSection}>
        <TextInput
          label={t('changePassword.currentPasswordLabel')}
          value={oldPassword}
          onChangeText={setOldPassword}
          error={errors.oldPassword}
          placeholder={t('changePassword.currentPasswordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          label={t('changePassword.newPasswordLabel')}
          value={newPassword}
          onChangeText={setNewPassword}
          error={errors.newPassword}
          placeholder={t('changePassword.newPasswordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
        />

        <TextInput
          label={t('changePassword.confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          placeholder={t('changePassword.confirmPasswordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
        />
      </View>
    </GlassSheet>
  );
};

const styles = StyleSheet.create({
  formSection: {
    gap: 12,
  },
});
