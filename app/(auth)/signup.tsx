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
  BackHandler,
  TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, TextInput } from '@/components/ui';
import {
  EnvelopeIcon,
  LockClosedIcon,
  UserIcon,
  CalendarIcon,
  ChevronLeftIcon,
} from 'react-native-heroicons/outline';
import DateTimePicker from '@react-native-community/datetimepicker';
import { authApi } from '@/lib/api';

type SignupStep = 'email' | 'password' | 'name' | 'dob' | 'gender' | 'verify';

const FORM_STEPS: SignupStep[] = ['email', 'password', 'name', 'dob', 'gender'];
const CODE_LENGTH = 6;

interface SignupData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | '';
}

export default function SignupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useAuth();
  const [currentStep, setCurrentStep] = useState<SignupStep>('email');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Verification code state
  const [verificationCode, setVerificationCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputRefs = useRef<(RNTextInput | null)[]>([]);

  const [formData, setFormData] = useState<SignupData>({
    email: params.email ?? '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    dateOfBirth: new Date(2000, 0, 1),
    gender: '',
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });

  // --- Resend cooldown timer ---
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // --- Android hardware back button ---
  useEffect(() => {
    const onBackPress = () => {
      if (currentStep === 'verify') {
        // Can't go back from verification -- account already created
        return true;
      }
      if (currentStep === 'email') {
        router.back();
        return true;
      }
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [currentStep]);

  // --- Validation helpers ---

  const validateEmail = () => {
    if (!formData.email.trim()) {
      setErrors((prev) => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    setErrors((prev) => ({ ...prev, email: '' }));
    return true;
  };

  const validatePassword = () => {
    const newErrors = { ...errors };
    let valid = true;

    if (!formData.password) {
      newErrors.password = 'Password is required';
      valid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      valid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and numbers';
      valid = false;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      valid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const validateName = () => {
    const newErrors = { ...errors };
    let valid = true;

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
      valid = false;
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
      valid = false;
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.firstName.trim())) {
      newErrors.firstName = 'First name contains invalid characters';
      valid = false;
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
      valid = false;
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
      valid = false;
    } else if (!/^[a-zA-Z\s'-]+$/.test(formData.lastName.trim())) {
      newErrors.lastName = 'Last name contains invalid characters';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const validateDateOfBirth = () => {
    const today = new Date();
    const birthDate = new Date(formData.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to create an account');
      return false;
    }

    return true;
  };

  const validateGender = () => {
    if (!formData.gender) {
      Alert.alert('Selection Required', 'Please select your gender identity');
      return false;
    }
    return true;
  };

  // --- Navigation ---

  const handleNext = () => {
    switch (currentStep) {
      case 'email':
        if (validateEmail()) setCurrentStep('password');
        break;
      case 'password':
        if (validatePassword()) setCurrentStep('name');
        break;
      case 'name':
        if (validateName()) setCurrentStep('dob');
        break;
      case 'dob':
        if (validateDateOfBirth()) setCurrentStep('gender');
        break;
      case 'gender':
        if (validateGender()) handleSignup();
        break;
    }
  };

  const handleBack = useCallback(() => {
    switch (currentStep) {
      case 'password':
        setCurrentStep('email');
        break;
      case 'name':
        setCurrentStep('password');
        break;
      case 'dob':
        setCurrentStep('name');
        break;
      case 'gender':
        setCurrentStep('dob');
        break;
    }
  }, [currentStep]);

  // --- Signup (register) ---

  const handleSignup = async () => {
    setLoading(true);

    try {
      await authApi.register({
        email: formData.email.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        date_of_birth: formData.dateOfBirth.toISOString().slice(0, 10),
        gender: formData.gender === '' ? undefined : (formData.gender as any),
      });

      // Registration succeeded -- move to verification step
      setLoading(false);
      setCurrentStep('verify');
      setResendCooldown(60);
    } catch (error) {
      console.error('Signup error:', error);
      setLoading(false);

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        // Edge case: user already registered but not verified -- go straight to verify step
        if (msg.includes('not verified') || (msg.includes('already registered') && msg.includes('verify'))) {
          setCurrentStep('verify');
          setResendCooldown(0);
          return;
        }

        // Other known patterns
        if (msg.includes('email') && msg.includes('already')) {
          Alert.alert('Signup Failed', 'This email is already registered. Please try logging in instead.');
        } else if (msg.includes('password') && msg.includes('least')) {
          Alert.alert('Signup Failed', 'Password must be at least 8 characters long.');
        } else if (msg.includes('age') || msg.includes('18')) {
          Alert.alert('Signup Failed', 'You must be at least 18 years old to create an account.');
        } else {
          Alert.alert('Signup Failed', error.message || 'Failed to create account. Please try again.');
        }
      } else {
        Alert.alert('Signup Failed', 'Failed to create account. Please try again.');
      }
    }
  };

  // --- Email verification ---

  const handleVerifyCode = async (code: string) => {
    setLoading(true);
    try {
      await authApi.verifyEmail(formData.email.trim(), code);

      // Verification succeeded -- now log in
      await authApi.login({
        email: formData.email.trim(),
        password: formData.password,
      });

      setLoading(false);
      signIn();
    } catch (error) {
      console.error('Verification error:', error);
      setLoading(false);

      const message =
        error instanceof Error
          ? error.message
          : 'Verification failed. Please check the code and try again.';
      Alert.alert('Verification Failed', message);

      // Clear code inputs so user can retry
      setVerificationCode(Array(CODE_LENGTH).fill(''));
      codeInputRefs.current[0]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    try {
      await authApi.resendVerificationCode(formData.email.trim());
      setResendCooldown(60);
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to resend code. Please try again.';
      Alert.alert('Error', message);
    }
  };

  // --- OTP input handlers ---

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const digit = text.replace(/[^0-9]/g, '');
    if (digit.length > 1) {
      // Handle paste -- distribute digits across boxes
      const digits = digit.split('').slice(0, CODE_LENGTH);
      const newCode = [...verificationCode];
      digits.forEach((d, i) => {
        if (index + i < CODE_LENGTH) {
          newCode[index + i] = d;
        }
      });
      setVerificationCode(newCode);

      // Focus the next empty box or the last filled one
      const nextIndex = Math.min(index + digits.length, CODE_LENGTH - 1);
      codeInputRefs.current[nextIndex]?.focus();

      // Auto-submit if all digits filled
      const fullCode = newCode.join('');
      if (fullCode.length === CODE_LENGTH && newCode.every((d) => d !== '')) {
        handleVerifyCode(fullCode);
      }
      return;
    }

    const newCode = [...verificationCode];
    newCode[index] = digit;
    setVerificationCode(newCode);

    // Move focus forward
    if (digit && index < CODE_LENGTH - 1) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    const fullCode = newCode.join('');
    if (fullCode.length === CODE_LENGTH && newCode.every((d) => d !== '')) {
      handleVerifyCode(fullCode);
    }
  };

  const handleCodeKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      // Move focus backward on empty backspace
      const newCode = [...verificationCode];
      newCode[index - 1] = '';
      setVerificationCode(newCode);
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // --- Progress bar ---

  const getStepProgress = () => {
    if (currentStep === 'verify') return 100;
    const currentIndex = FORM_STEPS.indexOf(currentStep);
    return ((currentIndex + 1) / FORM_STEPS.length) * 100;
  };

  // --- Render helpers ---

  const renderStepContent = () => {
    switch (currentStep) {
      case 'email':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Enter your email</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We'll use this to create your account
              </Text>
            </View>
            <TextInput
              label="Email address"
              placeholder="your.email@example.com"
              value={formData.email}
              onChangeText={(text) => {
                setFormData({ ...formData, email: text });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              leftIcon={<EnvelopeIcon color={colors.textSecondary} size={20} />}
            />
          </>
        );

      case 'password':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Create a password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Choose a strong password to secure your account
              </Text>
            </View>
            <TextInput
              label="Password"
              placeholder="Min 8 chars, uppercase, lowercase, numbers"
              value={formData.password}
              onChangeText={(text) => {
                setFormData({ ...formData, password: text });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              leftIcon={<LockClosedIcon color={colors.textSecondary} size={20} />}
            />
            <TextInput
              label="Confirm password"
              placeholder="Re-enter your password"
              value={formData.confirmPassword}
              onChangeText={(text) => {
                setFormData({ ...formData, confirmPassword: text });
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
              leftIcon={<LockClosedIcon color={colors.textSecondary} size={20} />}
            />
          </>
        );

      case 'name':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>What's your name?</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                This is how you'll appear in the community
              </Text>
            </View>
            <TextInput
              label="First name"
              placeholder="John"
              value={formData.firstName}
              onChangeText={(text) => {
                setFormData({ ...formData, firstName: text });
                if (errors.firstName) setErrors({ ...errors, firstName: '' });
              }}
              error={errors.firstName}
              autoCapitalize="words"
              autoComplete="name-given"
              autoFocus
              leftIcon={<UserIcon color={colors.textSecondary} size={20} />}
            />
            <TextInput
              label="Last name"
              placeholder="Doe"
              value={formData.lastName}
              onChangeText={(text) => {
                setFormData({ ...formData, lastName: text });
                if (errors.lastName) setErrors({ ...errors, lastName: '' });
              }}
              error={errors.lastName}
              autoCapitalize="words"
              autoComplete="name-family"
              leftIcon={<UserIcon color={colors.textSecondary} size={20} />}
            />
          </>
        );

      case 'dob':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>When's your birthday?</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We use this to personalize your experience
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.dateButton,
                { backgroundColor: colors.inputBackground, borderColor: colors.border },
              ]}
              onPress={() => setShowDatePicker(true)}
            >
              <CalendarIcon color={colors.textSecondary} size={20} />
              <Text style={[styles.dateButtonText, { color: colors.text }]}>
                {formData.dateOfBirth.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.dateOfBirth}
                mode="date"
                display="spinner"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    setFormData({ ...formData, dateOfBirth: selectedDate });
                  }
                }}
                maximumDate={new Date()}
              />
            )}
          </>
        );

      case 'gender':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>How do you identify?</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                This helps us provide a personalized experience
              </Text>
            </View>
            <View style={styles.genderOptions}>
              {[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'prefer_not_to_say', label: 'Prefer not to say' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.genderOption,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor:
                        formData.gender === option.value ? colors.primary : colors.border,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() =>
                    setFormData({
                      ...formData,
                      gender: option.value as SignupData['gender'],
                    })
                  }
                >
                  <Text
                    style={[
                      styles.genderOptionText,
                      {
                        color:
                          formData.gender === option.value ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'verify':
        return (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Verify your email</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                We sent a 6-digit code to{' '}
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {formData.email.trim()}
                </Text>
              </Text>
            </View>

            {/* OTP code input boxes */}
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
                  editable={!loading}
                />
              ))}
            </View>

            {loading && (
              <View style={styles.verifyingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.verifyingText, { color: colors.textSecondary }]}>
                  Verifying...
                </Text>
              </View>
            )}

            {/* Resend code */}
            <View style={styles.resendContainer}>
              <Text style={[styles.resendLabel, { color: colors.textSecondary }]}>
                Didn't receive the code?
              </Text>
              {resendCooldown > 0 ? (
                <Text style={[styles.resendCooldown, { color: colors.textSecondary }]}>
                  Resend in {resendCooldown}s
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResendCode}>
                  <Text style={[styles.resendButton, { color: colors.primary }]}>
                    Resend code
                  </Text>
                </TouchableOpacity>
              )}
            </View>
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
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {currentStep !== 'email' && currentStep !== 'verify' && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ChevronLeftIcon color={colors.text} size={24} />
            </TouchableOpacity>
          )}
          <View style={[styles.progressBarBackground, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                { backgroundColor: colors.primary, width: `${getStepProgress()}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStepContent()}

          {/* Show Continue / Create Account button only for form steps (not verify) */}
          {currentStep !== 'verify' && (
            <Button
              title={currentStep === 'gender' ? 'Create Account' : 'Continue'}
              onPress={handleNext}
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              style={styles.submitButton}
              disabled={currentStep === 'gender' && !formData.gender}
            />
          )}
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  dateButtonText: {
    fontSize: 16,
  },
  genderOptions: {
    gap: 12,
  },
  genderOption: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  genderOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Verification code styles
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
  verifyingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  verifyingText: {
    fontSize: 14,
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
