import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { LeaderboardUser } from '@/types/leaderboard';
import { CURRENT_USER_ID } from '@/lib/utils/mockLeaderboardData';

interface LeaderboardRowProps {
  user: LeaderboardUser;
  valueType: 'distance' | 'trips';
  index: number;
}

export function LeaderboardRow({ user, valueType, index }: LeaderboardRowProps) {
  const { colors } = useTheme();
  const { formatDistance } = useUnits();

  const isCurrentUser = user.id === CURRENT_USER_ID;
  const isTopThree = user.rank <= 3;

  const getRankDisplay = () => {
    switch (user.rank) {
      case 1:
        return { text: '1', color: '#FFD700' }; // Gold
      case 2:
        return { text: '2', color: '#C0C0C0' }; // Silver
      case 3:
        return { text: '3', color: '#CD7F32' }; // Bronze
      default:
        return { text: String(user.rank), color: colors.textSecondary };
    }
  };

  const rankDisplay = getRankDisplay();

  const getInitials = () => {
    const first = user.firstName.charAt(0).toUpperCase();
    const last = user.lastName.charAt(0).toUpperCase();
    return last ? `${first}${last}` : first;
  };

  const formatValue = () => {
    if (valueType === 'distance') {
      return formatDistance(user.value);
    }
    return `${Math.round(user.value)} trips`;
  };

  const fullName = user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.firstName;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isCurrentUser
            ? `${colors.accent}20`
            : index % 2 === 0
            ? colors.background
            : colors.card,
        },
        isCurrentUser && {
          borderLeftWidth: 3,
          borderLeftColor: colors.accent,
        },
      ]}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        <View
          style={[
            styles.rankBadge,
            isTopThree && {
              backgroundColor: `${rankDisplay.color}20`,
              borderColor: rankDisplay.color,
              borderWidth: 1,
            },
          ]}
        >
          <ThemedText
            style={[
              styles.rankText,
              {
                color: isTopThree ? rankDisplay.color : colors.textSecondary,
                fontWeight: isTopThree ? '700' : '500',
              },
            ]}
          >
            {rankDisplay.text}
          </ThemedText>
        </View>
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}
          >
            <ThemedText style={styles.avatarInitials}>{getInitials()}</ThemedText>
          </View>
        )}
      </View>

      {/* Name */}
      <View style={styles.nameContainer}>
        <ThemedText
          style={[
            styles.name,
            isCurrentUser && { fontWeight: '600', color: colors.primary },
          ]}
          numberOfLines={1}
        >
          {fullName}
        </ThemedText>
      </View>

      {/* Value */}
      <View style={styles.valueContainer}>
        <ThemedText
          style={[
            styles.value,
            isCurrentUser && { fontWeight: '600', color: colors.primary },
          ]}
        >
          {formatValue()}
        </ThemedText>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
  },
  avatarContainer: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  nameContainer: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  name: {
    fontSize: 15,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
});
