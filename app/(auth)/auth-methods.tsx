import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { EnvelopeIcon } from 'react-native-heroicons/outline';

export default function AuthMethodsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const handleGoogleSignIn = () => {
    // TODO: Implement Google Sign In
    console.log('Google Sign In');
  };

  const handleAppleSignIn = () => {
    // TODO: Implement Apple Sign In
    console.log('Apple Sign In');
  };

  const handleEmailSignIn = () => {
    router.push('/(auth)/login');
  };

  const handleEmailSignUp = () => {
    router.push('/(auth)/signup');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Let's get started</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to get things done - your rides, stats, and achievements all in one place.
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          {/* Google Button */}
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleGoogleSignIn}
          >
            <View style={styles.socialButtonContent}>
              <Text style={[styles.socialButtonIcon, { color: colors.text }]}>G</Text>
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Continue with Google
              </Text>
            </View>
          </TouchableOpacity>

          {/* Apple Button */}
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: '#000000' }]}
            onPress={handleAppleSignIn}
          >
            <View style={styles.socialButtonContent}>
              <Text style={[styles.socialButtonIcon, { color: '#FFFFFF' }]}></Text>
              <Text style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
                Continue with Apple
              </Text>
            </View>
          </TouchableOpacity>

          {/* Email Button */}
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleEmailSignIn}
          >
            <View style={styles.socialButtonContent}>
              <EnvelopeIcon color={colors.text} size={24} />
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Continue with email
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            Don't have an account?{' '}
            <Text
              style={[styles.footerLink, { color: colors.primary }]}
              onPress={handleEmailSignUp}
            >
              Sign up
            </Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  buttonGroup: {
    gap: 16,
  },
  socialButton: {
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  socialButtonIcon: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontWeight: '600',
  },
});
