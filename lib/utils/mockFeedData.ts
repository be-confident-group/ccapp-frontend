/**
 * Mock data for feed development
 */

import type { ActivityPost, FeedGroup } from '@/types/feed';

export const mockGroups: FeedGroup[] = [
  {
    id: '1',
    name: 'City Cyclists',
    logoUrl: undefined,
    memberCount: 128,
  },
  {
    id: '2',
    name: 'Morning Walkers',
    logoUrl: undefined,
    memberCount: 56,
  },
  {
    id: '3',
    name: 'Weekend Warriors',
    logoUrl: undefined,
    memberCount: 89,
  },
  {
    id: '4',
    name: 'Park Runners',
    logoUrl: undefined,
    memberCount: 234,
  },
];

export const mockPosts: ActivityPost[] = [
  {
    id: '1',
    user: {
      id: 'u1',
      name: 'Sarah Johnson',
      avatarUrl: undefined,
    },
    location: 'Central Park, NYC',
    photos: [
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800',
      'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800',
      'https://images.unsplash.com/photo-1505705694340-019e1e335916?w=800',
    ],
    caption: 'Beautiful morning ride through the park! The weather was perfect and I managed to beat my personal best. Feeling great!',
    activityType: 'ride',
    distance: 15.5,
    duration: 3600,
    likeCount: 24,
    commentCount: 5,
    isLiked: false,
    createdAt: new Date().toISOString(),
    groupId: '1',
  },
  {
    id: '2',
    user: {
      id: 'u2',
      name: 'Mike Chen',
      avatarUrl: undefined,
    },
    location: 'Riverside Trail',
    photos: [
      'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800',
    ],
    caption: 'Evening walk with the family. Fresh air and great conversation! Sometimes the simple things are the best.',
    activityType: 'walk',
    distance: 3.2,
    duration: 2700,
    likeCount: 12,
    commentCount: 2,
    isLiked: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    groupId: '2',
  },
  {
    id: '3',
    user: {
      id: 'u3',
      name: 'Emma Wilson',
      avatarUrl: undefined,
    },
    location: 'Brooklyn Bridge',
    photos: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800',
    ],
    caption: 'Conquered the bridge today! The views never get old. Who wants to join me next weekend?',
    activityType: 'run',
    distance: 8.0,
    duration: 2400,
    likeCount: 45,
    commentCount: 8,
    isLiked: false,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    groupId: '3',
  },
  {
    id: '4',
    user: {
      id: 'u4',
      name: 'David Park',
      avatarUrl: undefined,
    },
    location: 'Hudson River Greenway',
    photos: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800',
      'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800',
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800',
    ],
    caption: 'Early morning ride before work. Nothing beats starting the day with some exercise and fresh air!',
    activityType: 'ride',
    distance: 22.3,
    duration: 4500,
    likeCount: 67,
    commentCount: 12,
    isLiked: true,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    groupId: '1',
  },
  {
    id: '5',
    user: {
      id: 'u5',
      name: 'Lisa Martinez',
      avatarUrl: undefined,
    },
    location: 'Prospect Park',
    photos: [
      'https://images.unsplash.com/photo-1486218119243-13883505764c?w=800',
    ],
    caption: 'First 5K of the season! Slow and steady, but I finished. Progress is progress.',
    activityType: 'run',
    distance: 5.0,
    duration: 1800,
    likeCount: 89,
    commentCount: 15,
    isLiked: false,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    groupId: '4',
  },
];
