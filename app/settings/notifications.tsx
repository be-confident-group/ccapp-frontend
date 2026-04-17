import React, { useCallback } from 'react';
import { StyleSheet, View, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/api/notifications';

type PrefKey = keyof NotificationPreferences;

interface PrefRow {
  key: PrefKey;
  label: string;
  subtitle: string;
}

const PREF_ROWS: PrefRow[] = [
  {
    key: 'likes',
    label: 'Likes',
    subtitle: 'When someone likes your post',
  },
  {
    key: 'comments',
    label: 'Comments',
    subtitle: 'When someone comments on your post',
  },
  {
    key: 'club_activity',
    label: 'Club Activity',
    subtitle: 'New posts in your clubs',
  },
  {
    key: 'join_requests',
    label: 'Join Requests',
    subtitle: 'When someone requests to join your group',
  },
];

export default function NotificationPreferencesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    mutationFn: (updated: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(updated),
    onSuccess: (data) => {
      queryClient.setQueryData<NotificationPreferences>(['notification-preferences'], data);
    },
  });

  const handleToggle = useCallback(
    (key: PrefKey, value: boolean) => {
      if (!prefs) return;
      mutation.mutate({ ...prefs, [key]: value });
    },
    [prefs, mutation]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Header title="Notification Preferences" showBack />
      <ThemedView style={styles.container}>
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Choose which notifications you want to receive
            </ThemedText>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {PREF_ROWS.map((row, index) => (
                <View key={row.key}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <ThemedText style={styles.rowLabel}>{row.label}</ThemedText>
                      <ThemedText style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                        {row.subtitle}
                      </ThemedText>
                    </View>
                    <Switch
                      value={prefs?.[row.key] ?? false}
                      onValueChange={(val) => handleToggle(row.key, val)}
                      disabled={mutation.isPending}
                      trackColor={{ false: colors.border, true: colors.primary + '80' }}
                      thumbColor={prefs?.[row.key] ? colors.primary : colors.textMuted}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md },
  sectionLabel: { fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSubtitle: { fontSize: 13 },
  divider: { height: 1, marginHorizontal: Spacing.md },
});
