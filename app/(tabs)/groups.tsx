import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function GroupsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Groups</ThemedText>
      <ThemedText style={styles.subtitle}>Community & Social</ThemedText>
      <View style={styles.placeholder}>
        <ThemedText>👥 My groups (horizontal scroll)</ThemedText>
        <ThemedText>📱 Activity feed</ThemedText>
        <ThemedText>💬 Posts, likes, comments</ThemedText>
        <ThemedText>🏆 Leaderboards</ThemedText>
        <ThemedText>🔍 Discover groups</ThemedText>
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
