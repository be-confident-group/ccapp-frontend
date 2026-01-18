import React, { useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import Header from '@/components/layout/Header';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import { useClubs } from '@/lib/hooks/useClubs';
import { UsersIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import type { Club } from '@/types/feed';

export default function BrowseClubsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

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
    ({ item }: { item: Club }) => {
      return (
        <TouchableOpacity
          style={[styles.clubCard, { backgroundColor: colors.card }]}
          onPress={() => handleClubPress(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.clubContent}>
            <View style={styles.clubHeader}>
              {item.photo ? (
                <Image source={{ uri: item.photo }} style={styles.clubPhoto} />
              ) : (
                <View style={[styles.clubPhotoPlaceholder, { backgroundColor: colors.border }]}>
                  <UsersIcon size={32} color={colors.textMuted} />
                </View>
              )}

              <View style={styles.clubInfo}>
                <ThemedText style={styles.clubName}>{item.name}</ThemedText>
                {item.description && (
                  <ThemedText
                    style={[styles.clubDescription, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.description}
                  </ThemedText>
                )}
                <View style={styles.clubMeta}>
                  <UsersIcon size={14} color={colors.textMuted} />
                  <ThemedText style={[styles.memberCount, { color: colors.textMuted }]}>
                    {item.members_count} {item.members_count === 1 ? 'member' : 'members'}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, handleClubPress]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t('clubs.searching', 'Searching groups...')}
          </ThemedText>
        </View>
      );
    }

    if (searchQuery && allClubs?.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MagnifyingGlassIcon size={64} color={colors.textMuted} />
          <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {t('clubs.noResults', 'No groups found')}
          </ThemedText>
          <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t('clubs.noResultsMessage', 'Try a different search term')}
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <UsersIcon size={64} color={colors.textMuted} />
        <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          {t('clubs.noClubsAvailable', 'No groups available')}
        </ThemedText>
        <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
          {t('clubs.createFirst', 'Be the first to create a group!')}
        </ThemedText>
      </View>
    );
  };

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
      <MagnifyingGlassIcon size={20} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={t('clubs.searchPlaceholder', 'Search groups...')}
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <Header title={t('clubs.browseClubs', 'Browse Groups')} showBack />
      <ThemedView style={styles.container}>
        {renderSearchBar()}
        <FlatList
          data={allClubs || []}
          renderItem={renderClubItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            (!allClubs || allClubs.length === 0) && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  emptyListContent: {
    flex: 1,
  },
  clubCard: {
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  clubContent: {
    gap: Spacing.md,
  },
  clubHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  clubPhoto: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  clubPhotoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '600',
  },
  clubDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  clubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  memberCount: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
