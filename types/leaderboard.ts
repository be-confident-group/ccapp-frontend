export interface LeaderboardUser {
  id: string;
  rank: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  value: number; // distance in km OR trip count
  gender?: 'male' | 'female';
  isNewMember?: boolean;
  joinedAt?: string;
}

export type MainTab = 'rides' | 'walks' | 'gender';

export type RidesWalksSubFilter = 'distance' | 'trips';

export type GenderSubFilter = 'male' | 'female' | 'new_male' | 'new_female';

export type LeaderboardCategory =
  | 'rides_distance'
  | 'rides_trips'
  | 'walks_distance'
  | 'walks_trips'
  | 'male_rider'
  | 'female_rider'
  | 'new_male_rider'
  | 'new_female_rider';

export interface LeaderboardFilters {
  month: string | null; // "2025-12" or null for "All Time"
  groupId: string | null; // null = all groups
  mainTab: MainTab;
  subFilter: RidesWalksSubFilter | GenderSubFilter;
}

export interface MonthOption {
  value: string | null; // "2025-12" or null for "All Time"
  label: string; // "December 2025" or "All Time"
}

export interface LeaderboardData {
  category: LeaderboardCategory;
  title: string;
  valueType: 'distance' | 'trips';
  users: LeaderboardUser[];
}
