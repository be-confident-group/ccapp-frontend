import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function YouScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>You</ThemedText>
      <ThemedText style={styles.subtitle}>Profile & Settings</ThemedText>
      <View style={styles.placeholder}>
        <ThemedText>👤 Profile header</ThemedText>
        <ThemedText>📊 Personal stats</ThemedText>
        <ThemedText>🏆 Achievements</ThemedText>
        <ThemedText>🚴 My trips</ThemedText>
        <ThemedText>⚙️ Settings</ThemedText>
        <ThemedText>🔔 Notifications</ThemedText>
        <ThemedText>🔒 Privacy</ThemedText>
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
  placeholder: {
    gap: 16,
  },
});
