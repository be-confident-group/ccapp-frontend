import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput } from '@/components/ui';
import {
  EnvelopeIcon,
  LockClosedIcon,
  ChevronLeftIcon,
} from 'react-native-heroicons/outline';
import { authApi } from '@/lib/api';
import { useTranslation } from 'react-i18next';

type ResetStep = 'email' | 'code' | 'password';
const CODE_LENGTH = 6;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const codeInputRefs = useRef<(RNTextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // --- Step 1: Email ---

  const handleSendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authApi.requestPasswordReset(trimmedEmail);
      setStep('code');
      setResendCooldown(60);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send reset code. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // --- Step 2: Code verification ---

  const handleCodeComplete = useCallback(async (code: string) => {
    // Just move to password step — code is validated on final submit
    setStep('password');
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '');
    if (digit.length > 1) {
      // Handle paste
      const digits = digit.split('').slice(0, CODE_LENGTH);
      const newCode = [...verificationCode];
      digits.forEach((d, i) => {
        if (index + i < CODE_LENGTH) {
          newCode[index + i] = d;
        }
      });
      setVerificationCode(newCode);
      const nextIndex = Math.min(index + digits.length, CODE_LENGTH - 1);
      codeInputRefs.current[nextIndex]?.focus();

      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH && newCode.every((d) => d !== '')) {
        handleCodeComplete(fullCode);
      }
      return;
    }

    const newCode = [...verificationCode];
    newCode[index] = digit;
    setVerificationCode(newCode);

    if (digit && index < CODE_LENGTH - 1) {
      codeInputRefs.current[index + 1]?.focus();
    }

    const fullCode = newCode.join('');
    if (fullCode.length === CODE_LENGTH && newCode.every((d) => d !== '')) {
      handleCodeComplete(fullCode);
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      const newCode = [...verificationCode];
      newCode[index - 1] = '';
      setVerificationCode(newCode);
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await authApi.requestPasswordReset(email.trim());
      setResendCooldown(60);
      Alert.alert('Code Sent', 'A new reset code has been sent to your email.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend code. Please try again.';
      Alert.alert('Error', message);
    }
  };

  // --- Step 3: New password ---

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Error', t('auth:resetPassword.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', t('auth:resetPassword.passwordMismatch'));
      return;
    }

    const code = verificationCode.join('');
    setLoading(true);
    try {
      await authApi.confirmPasswordReset(email.trim(), code, newPassword);
      Alert.alert(
        t('auth:resetPassword.successTitle'),
        t('auth:resetPassword.successMessage'),
        [{ text: 'OK', onPress: () => router.replace('/(auth)/welcome') }]
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  // --- Back handler ---

  const handleBack = () => {
    if (step === 'password') {
      setStep('code');
      setNewPassword('');
      setConfirmPassword('');
    } else if (step === 'code') {
      setStep('email');
      setVerificationCode(Array(CODE_LENGTH).fill(''));
    } else {
      router.back();
    }
  };

  // --- Render ---

  const renderStepContent = () => {
    switch (step) {
      case 'email':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('auth:resetPassword.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('auth:resetPassword.subtitle')}
              </Text>
            </View>

            <TextInput
              placeholder={t('auth:resetPassword.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              leftIcon={<EnvelopeIcon color={colors.textSecondary} size={20} />}
            />

            <Button
              title={t('auth:resetPassword.sendButton')}
              onPress={handleSendCode}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={!email.trim()}
              style={styles.submitButton}
            />

            <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
              <Text style={[styles.backLinkText, { color: colors.primary }]}>
                {t('auth:resetPassword.backToLogin')}
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'code':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('auth:resetPassword.checkEmail')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('auth:resetPassword.codeSent')}{' '}
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {email.trim()}
                </Text>
              </Text>
            </View>

            <View style={styles.codeContainer}>
              {verificationCode.map((digit, index) => (
                <RNTextInput
                  key={index}
                  ref={(ref) => { codeInputRefs.current[index] = ref; }}
                  style={[
                    styles.codeInput,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor: digit ? colors.primary : colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleCodeKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? CODE_LENGTH : 1}
                  autoFocus={index === 0}
                  selectTextOnFocus
                />
              ))}
            </View>

            <View style={styles.resendContainer}>
              <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>
                {t('auth:resetPassword.didntReceive')}
              </Text>
              {resendCooldown > 0 ? (
                <Text style={[styles.resendCooldown, { color: colors.textSecondary }]}>
                  {t('auth:resetPassword.resendCooldown', { seconds: resendCooldown })}
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode}>
                  <Text style={[styles.resendButton, { color: colors.primary }]}>
                    {t('auth:resetPassword.resendCode')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        );

      case 'password':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('auth:resetPassword.newPassword')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('auth:resetPassword.newPasswordSubtitle')}
              </Text>
            </View>

            <TextInput
              placeholder={t('auth:resetPassword.newPasswordPlaceholder')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              leftIcon={<LockClosedIcon color={colors.textSecondary} size={20} />}
            />

            <TextInput
              placeholder={t('auth:resetPassword.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<LockClosedIcon color={colors.textSecondary} size={20} />}
            />

            <Button
              title={t('auth:resetPassword.resetButton')}
              onPress={handleResetPassword}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              disabled={!newPassword || !confirmPassword}
              style={styles.submitButton}
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeftIcon color={colors.text} size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}
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
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
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
  submitButton: {
    marginTop: 24,
  },
  backLink: {
    alignItems: 'center',
    marginTop: 24,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
  },
  resendContainer: {
    alignItems: 'center',
    gap: 8,
  },
  resendLabel: {
    fontSize: 14,
  },
  resendCooldown: {
    fontSize: 14,
    fontWeight: '600',
  },
  resendButton: {
    fontSize: 14,
    fontWeight: '600',
  },
});
