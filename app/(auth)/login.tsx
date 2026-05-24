import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput } from '@/components/ui';
import { EnvelopeIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { useRouter } from 'expo-router';
import { authApi } from '@/lib/api';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    let valid = true;
    const newErrors = { email: '', password: '' };

    if (!email) {
      newErrors.email = t('auth:login.emailRequired');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth:login.emailInvalid');
      valid = false;
    }

    if (!password) {
      newErrors.password = t('auth:login.passwordRequired');
      valid = false;
    } else if (password.length < 6) {
      newErrors.password = t('auth:login.passwordTooShort');
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      await authApi.login({
        email: email.trim(),
        password: password,
      });

      setLoading(false);
      signIn();
    } catch (error) {
      setLoading(false);

      const errorMessage = error instanceof Error
        ? error.message
        : t('auth:login.unexpectedError');

      Alert.alert(t('auth:login.errorTitle'), errorMessage);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('auth:login.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('auth:login.subtitle')}
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              label={t('auth:common.emailAddressLabel')}
              placeholder={t('auth:common.emailPlaceholder')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<EnvelopeIcon color={colors.textSecondary} size={20} />}
            />

            <TextInput
              label={t('auth:common.passwordLabel')}
              placeholder={t('auth:common.passwordPlaceholder')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              leftIcon={<LockClosedIcon color={colors.textSecondary} size={20} />}
            />

            <Text
              style={[styles.forgotPassword, { color: colors.primary }]}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              {t('auth:login.forgotPassword')}
            </Text>

            <Button
              title={t('auth:login.signInButton')}
              onPress={handleLogin}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    marginBottom: 32,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -8,
    marginBottom: 24,
  },
  submitButton: {
    marginTop: 8,
  },
});
