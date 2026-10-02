import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { MagnifyingGlassIcon, PlusIcon, UsersIcon } from 'react-native-heroicons/outline';
import { ChevronRightIcon } from 'react-native-heroicons/mini';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { ClubThumb, Entrance, PressableCard } from '@/components/clubs/clubUi';
import { useTheme } from '@/contexts/ThemeContext';
import { useClubs } from '@/lib/hooks/useClubs';

const SUGGESTION_COUNT = 4;

interface MyGroupsEmptyProps {
  onBrowse: () => void;
  onCreate: () => void;
  onOpenClub: (clubId: number) => void;
}

/**
 * Empty state for My Groups: an inviting hero card with Browse / Create
 * actions, followed by a few suggested groups to open straight away.
 */
export function MyGroupsEmpty({ onBrowse, onCreate, onOpenClub }: MyGroupsEmptyProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const { data: clubs } = useClubs();
  const suggestions = (clubs ?? []).slice(0, SUGGESTION_COUNT);
  const previewPhotos = suggestions.filter((club) => !!club.photo).slice(0, 3);

  return (
    <View style={styles.container}>
      <Entrance index={0}>
        <View style={[styles.hero, { backgroundColor: colors.card }]}>
          {previewPhotos.length >= 2 ? (
            <View style={styles.cluster}>
              {previewPhotos.map((club, i) => (
                <View
                  key={club.id}
                  style={[
                    styles.clusterItem,
                    { borderColor: colors.card, marginLeft: i === 0 ? 0 : -18, zIndex: previewPhotos.length - i },
                  ]}
                >
                  <ClubThumb uri={club.photo} size={56} />
                </View>
              ))}
            </View>
          ) : (
            <LinearGradient
              colors={[colors.glassActiveFill, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <UsersIcon size={32} color="#FFFFFF" />
            </LinearGradient>
          )}

          <ThemedText style={styles.title}>{t('clubs.emptyTitle', { defaultValue: 'Ride together' })}</ThemedText>
          <ThemedText style={[styles.message, { color: colors.textSecondary }]}>
            {t('clubs.emptyMessage', {
              defaultValue: 'Join a group to share trips, climb the leaderboards and keep each other motivated.',
            })}
          </ThemedText>

          <View style={styles.actions}>
            <Button
              title={t('clubs.browseClubs', 'Browse Groups')}
              size="large"
              fullWidth
              icon={<MagnifyingGlassIcon size={18} color="#FFFFFF" />}
              onPress={onBrowse}
              style={styles.pill}
            />
            <Button
              title={t('clubs.createClub', 'Create Group')}
              variant="glass"
              size="large"
              fullWidth
              icon={<PlusIcon size={18} color={colors.glassTint} />}
              onPress={onCreate}
              style={styles.pill}
            />
          </View>
        </View>
      </Entrance>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <ThemedText style={[styles.caption, { color: colors.textSecondary }]}>
            {t('clubs.suggested', { defaultValue: 'Suggested for you' })}
          </ThemedText>
          {suggestions.map((club, i) => (
            <Entrance key={club.id} index={i + 1}>
              <PressableCard onPress={() => onOpenClub(club.id)} accessibilityLabel={club.name}>
                <View style={styles.row}>
                  <ClubThumb uri={club.photo} size={44} />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle} numberOfLines={1}>
                      {club.name}
                    </ThemedText>
                    <ThemedText style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {t('clubs.memberCount', { count: club.members_count })}
                    </ThemedText>
                  </View>
                  <ChevronRightIcon size={20} color={colors.textSecondary} />
                </View>
              </PressableCard>
            </Entrance>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  cluster: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  clusterItem: {
    borderWidth: 3,
    borderRadius: 20,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 10,
  },
  pill: {
    borderRadius: 999,
  },
  suggestions: {
    gap: 10,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
  },
});
