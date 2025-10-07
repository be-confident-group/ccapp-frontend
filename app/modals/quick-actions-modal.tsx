import { StyleSheet, TouchableOpacity, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ActionItem = {
  icon: string;
  title: string;
  onPress: () => void;
};

export default function QuickActionsModal() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const actions: ActionItem[] = [
    {
      icon: 'bicycle',
      title: 'Start a Ride',
      onPress: () => {
        router.back();
        // TODO: Navigate to tracking screen
      },
    },
    {
      icon: 'pencil',
      title: 'Log Ride Manually',
      onPress: () => {
        router.back();
        // TODO: Navigate to manual entry
      },
    },
    {
      icon: 'megaphone.fill',
      title: 'Share Update',
      onPress: () => {
        router.back();
        // TODO: Navigate to create post
      },
    },
    {
      icon: 'camera.fill',
      title: 'Share Photo',
      onPress: () => {
        router.back();
        // TODO: Navigate to photo picker
      },
    },
    {
      icon: 'person.3.fill',
      title: 'Create Group',
      onPress: () => {
        router.back();
        // TODO: Navigate to create group
      },
    },
    {
      icon: 'link',
      title: 'Join Group',
      onPress: () => {
        router.back();
        // TODO: Show join group dialog
      },
    },
  ];

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backdrop}
        onPress={() => router.back()}
      />
      <ThemedView style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.handle} />

        <View style={styles.content}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colorScheme === 'dark' ? colors.card : '#fff',
                  borderColor: colors.card,
                }
              ]}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                <IconSymbol name={action.icon as any} size={24} color="#fff" />
              </View>
              <ThemedText style={styles.actionText}>{action.title}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <IconSymbol name="xmark" size={28} color="#fff" />
        </TouchableOpacity>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  content: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
});
