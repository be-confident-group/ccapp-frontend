import { StyleSheet, View, Alert } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function YouScreen() {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await signOut();
            // Navigation will occur via guard; no need to set loading false here
          },
        },
      ]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>You</ThemedText>
      <ThemedText style={styles.subtitle}>Profile & Settings</ThemedText>

      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>Theme</ThemedText>
        <ThemeToggle />
      </View>

      <View style={styles.placeholder}>
        <ThemedText>👤 Profile header</ThemedText>
        <ThemedText>📊 Personal stats</ThemedText>
        <ThemedText>🏆 Achievements</ThemedText>
        <ThemedText>🚴 My trips</ThemedText>
        <ThemedText>⚙️ Settings</ThemedText>
        <ThemedText>🔔 Notifications</ThemedText>
        <ThemedText>🔒 Privacy</ThemedText>
      </View>

      <View style={styles.logoutSection}>
        <Button
          title="Log Out"
          onPress={handleLogout}
          variant="secondary"
          size="large"
          fullWidth
          loading={loading}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    marginTop: 40,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  placeholder: {
    gap: 16,
    marginBottom: 32,
  },
  logoutSection: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
});
