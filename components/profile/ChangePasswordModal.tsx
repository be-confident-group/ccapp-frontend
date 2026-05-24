import React, { useState } from 'react';
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
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { TextInput } from '@/components/ui';
import { authApi } from '@/lib/api/auth';

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.cancelButton} disabled={saving}>
            <Text style={[styles.cancelText, { color: saving ? colors.textSecondary : colors.text }]}>{t('changePassword.cancel')}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('changePassword.title')}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveButton} disabled={saving}>
            <Text style={[styles.saveText, { color: saving ? colors.textSecondary : colors.primary }]}>
              {saving ? t('changePassword.saving') : t('changePassword.save')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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
        </ScrollView>
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
  formSection: {
    gap: 12,
  },
});
