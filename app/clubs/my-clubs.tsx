import React, { useCallback, useState, useMemo } from 'react';
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
import { useMyClubs } from '@/lib/hooks/useClubs';
import { UsersIcon, PlusCircleIcon, MagnifyingGlassIcon } from 'react-native-heroicons/outline';
import type { Club } from '@/types/feed';

export default function MyClubsScreen() {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const { data: clubs, isLoading, refetch, isRefetching } = useMyClubs();

  // Filter clubs based on search query
  const filteredClubs = useMemo(() => {
    if (!clubs) return [];
    if (!searchQuery.trim()) return clubs;
    const query = searchQuery.toLowerCase();
    return clubs.filter(
      (club) =>
        club.name.toLowerCase().includes(query) ||
        club.description?.toLowerCase().includes(query)
    );
  }, [clubs, searchQuery]);

  const handleClubPress = useCallback((clubId: number) => {
    router.push(`/clubs/${clubId}`);
  }, []);

  const handleCreateClub = useCallback(() => {
    router.push('/clubs/create');
  }, []);

  const handleBrowseClubs = useCallback(() => {
    router.push('/clubs/browse');
  }, []);

  const renderClubItem = useCallback(
    ({ item }: { item: Club }) => (
      <TouchableOpacity
        style={[styles.clubCard, { backgroundColor: colors.card }]}
        onPress={() => handleClubPress(item.id)}
        activeOpacity={0.7}
      >
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
      </TouchableOpacity>
    ),
    [colors, handleClubPress]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {t('clubs.loading', 'Loading your groups...')}
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <UsersIcon size={64} color={colors.textMuted} />
        <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          {t('clubs.noClubs', 'No Groups Yet')}
        </ThemedText>
        <ThemedText style={[styles.emptyMessage, { color: colors.textMuted }]}>
          {t('clubs.noClubsMessage', 'Join or create a group to connect with others!')}
        </ThemedText>
        <TouchableOpacity
          style={[styles.browseButton, { backgroundColor: colors.primary }]}
          onPress={handleBrowseClubs}
          activeOpacity={0.8}
        >
          <ThemedText style={[styles.browseButtonText, { color: '#fff' }]}>
            {t('clubs.browseClubs', 'Browse Groups')}
          </ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <ThemedView style={styles.container}>
        <Header
          title={t('clubs.myClubs', 'My Groups')}
          showBack
          rightElement={
            <TouchableOpacity onPress={handleCreateClub} style={styles.headerButton}>
              <PlusCircleIcon size={22} color={colors.primary} />
            </TouchableOpacity>
          }
        />
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MagnifyingGlassIcon size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('clubs.searchMyClubs', 'Search my groups...')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={filteredClubs}
          renderItem={renderClubItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            filteredClubs.length === 0 && styles.emptyListContent,
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
  headerButton: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
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
  browseButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.md,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
