import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
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

type SignupStep = 'email' | 'password' | 'name' | 'dob' | 'gender';

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
  const { signIn } = useAuth();
  const [currentStep, setCurrentStep] = useState<SignupStep>('email');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState<SignupData>({
    email: '',
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

  const validateEmail = () => {
    if (!formData.email.trim()) {
      setErrors({ ...errors, email: 'Email is required' });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrors({ ...errors, email: 'Please enter a valid email address' });
      return false;
    }
    setErrors({ ...errors, email: '' });
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

  const handleBack = () => {
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
  };

  const handleSignup = async () => {
    setLoading(true);

    try {
      // Call the backend API to register the user
      await authApi.register({
        email: formData.email.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        date_of_birth: formData.dateOfBirth.toISOString().slice(0, 10), // YYYY-MM-DD
        gender: formData.gender === '' ? undefined : (formData.gender as any),
      });

      // Success! Set loading to false
      setLoading(false);

      // Update auth state - this will trigger navigation via AuthContext
      signIn();
    } catch (error) {
      console.error('Signup error:', error);
      setLoading(false);

      // Handle specific error cases
      let errorMessage = 'Failed to create account. Please try again.';

      if (error instanceof Error) {
        // Use the full error message from the backend
        errorMessage = error.message || errorMessage;

        // Check for common error patterns and provide helpful messages
        if (error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('already')) {
          errorMessage = 'This email is already registered. Please try logging in instead.';
        } else if (error.message.toLowerCase().includes('password') && error.message.toLowerCase().includes('least')) {
          errorMessage = 'Password must be at least 8 characters long.';
        } else if (error.message.toLowerCase().includes('age') || error.message.toLowerCase().includes('18')) {
          errorMessage = 'You must be at least 18 years old to create an account.';
        }
      }

      Alert.alert('Signup Failed', errorMessage);
    }
  };

  const getStepProgress = () => {
    const steps = ['email', 'password', 'name', 'dob', 'gender'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

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
            )
            }
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
                      borderWidth: formData.gender === option.value ? 2 : 2,
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
          {currentStep !== 'email' && (
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
});
