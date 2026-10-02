import React, { useState, useCallback } from 'react';
import { StyleSheet, View, RefreshControl, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MagnifyingGlassIcon, UsersIcon, LockClosedIcon } from 'react-native-heroicons/outline';
import { ChevronRightIcon } from 'react-native-heroicons/mini';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useClubs } from '@/lib/hooks/useClubs';
import {
  ClubChip,
  ClubEmptyState,
  ClubScreenHeader,
  ClubSearchBar,
  ClubThumb,
  Entrance,
  PressableCard,
  useClubScroll,
} from '@/components/clubs/clubUi';
import type { Club } from '@/types/feed';

export default function BrowseClubsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll, topInset } = useClubScroll();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: allClubs, isLoading, refetch, isRefetching } = useClubs(debouncedSearch);

  const handleClubPress = useCallback((clubId: number) => {
    router.push(`/clubs/${clubId}`);
  }, []);

  const renderClubItem = useCallback(
    ({ item, index }: { item: Club; index: number }) => (
      <Entrance index={index}>
        <PressableCard onPress={() => handleClubPress(item.id)} accessibilityLabel={item.name}>
          <View style={styles.cardRow}>
            <ClubThumb uri={item.photo} />
            <View style={styles.info}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {item.name}
              </ThemedText>
              {item.description ? (
                <ThemedText style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              ) : null}
              <View style={styles.chips}>
                <ClubChip
                  icon={<UsersIcon size={13} color={colors.glassTint} />}
                  label={t('clubs.memberCount', { count: item.members_count })}
                />
                {item.visibility === 'private' ? (
                  <ClubChip
                    icon={<LockClosedIcon size={13} color={colors.glassTint} />}
                    label={t('clubs.private', { defaultValue: 'Private' })}
                  />
                ) : null}
              </View>
            </View>
            <ChevronRightIcon size={20} color={colors.textSecondary} />
          </View>
        </PressableCard>
      </Entrance>
    ),
    [colors, handleClubPress, t]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('clubs.searching', 'Searching groups...')}
          </ThemedText>
        </View>
      );
    }

    if (searchQuery && allClubs?.length === 0) {
      return (
        <ClubEmptyState
          icon={<MagnifyingGlassIcon size={30} color={colors.glassTint} />}
          title={t('clubs.noResults', 'No groups found')}
          message={t('clubs.noResultsMessage', 'Try a different search term')}
        />
      );
    }

    return (
      <ClubEmptyState
        icon={<UsersIcon size={30} color={colors.glassTint} />}
        title={t('clubs.noClubsAvailable', 'No groups available')}
        message={t('clubs.createFirst', 'Be the first to create a group!')}
      />
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.backgroundSecondary }]}>
      <Animated.FlatList
        data={allClubs || []}
        renderItem={renderClubItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <ClubSearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('clubs.searchPlaceholder', 'Search groups...')}
          />
        }
        ItemSeparatorComponent={Separator}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: topInset, paddingBottom: insets.bottom + 32 },
          (!allClubs || allClubs.length === 0) && styles.emptyListContent,
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            progressViewOffset={topInset}
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
      <ClubScreenHeader title={t('clubs.browseClubs', 'Browse Groups')} scrollY={scrollY} />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16 },
  emptyListContent: { flexGrow: 1 },
  separator: { height: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 17, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 14 },
});
