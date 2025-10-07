import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function MapsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>Maps</ThemedText>
      <ThemedText style={styles.subtitle}>Tracking & Routes</ThemedText>
      <View style={styles.placeholder}>
        <ThemedText>🗺️ Map view with toggles</ThemedText>
        <ThemedText>📍 Track / History / Feedback / Heatmap</ThemedText>
        <ThemedText>▶️ Start Ride FAB</ThemedText>
        <ThemedText>📝 Recent trips list</ThemedText>
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
