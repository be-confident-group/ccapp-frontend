import { Stack } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="permissions-wizard" />
      <Stack.Screen name="all-set" />
    </Stack>
  );
}
