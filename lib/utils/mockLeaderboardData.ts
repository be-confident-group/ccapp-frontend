import type { LeaderboardUser, LeaderboardData, MonthOption } from '@/types/leaderboard';

// Generate mock users with realistic data
const generateUsers = (
  count: number,
  valueRange: [number, number],
  options?: {
    gender?: 'male' | 'female';
    isNew?: boolean;
  }
): LeaderboardUser[] => {
  const firstNames = {
    male: ['John', 'Mike', 'David', 'Chris', 'James', 'Robert', 'Michael', 'William', 'Daniel', 'Matthew', 'Andrew', 'Joseph', 'Ryan', 'Brandon', 'Tyler', 'Kevin', 'Brian', 'Jason', 'Eric', 'Steven'],
    female: ['Sarah', 'Emily', 'Jessica', 'Ashley', 'Amanda', 'Stephanie', 'Jennifer', 'Elizabeth', 'Lauren', 'Megan', 'Rachel', 'Nicole', 'Samantha', 'Katherine', 'Michelle', 'Amber', 'Brittany', 'Heather', 'Christina', 'Rebecca'],
  };
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris'];

  const users: LeaderboardUser[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    const gender = options?.gender || (Math.random() > 0.5 ? 'male' : 'female');
    const names = firstNames[gender];

    let firstName: string;
    let lastName: string;
    let fullName: string;

    // Ensure unique names
    do {
      firstName = names[Math.floor(Math.random() * names.length)];
      lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));

    usedNames.add(fullName);

    // Generate decreasing values for rankings
    const maxValue = valueRange[1];
    const minValue = valueRange[0];
    const valueDecay = (maxValue - minValue) / count;
    const baseValue = maxValue - (i * valueDecay);
    const randomVariation = (Math.random() - 0.5) * valueDecay * 0.5;
    const value = Math.max(minValue, baseValue + randomVariation);

    users.push({
      id: `user-${i + 1}-${Date.now()}`,
      rank: i + 1,
      firstName,
      lastName,
      avatarUrl: Math.random() > 0.3 ? `https://i.pravatar.cc/150?u=${firstName}${lastName}` : undefined,
      value: Math.round(value * 10) / 10,
      gender,
      isNewMember: options?.isNew,
      joinedAt: options?.isNew
        ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return users;
};

// Pre-generated mock data for each category
export const mockLeaderboardData: Record<string, LeaderboardData> = {
  rides_distance: {
    category: 'rides_distance',
    title: 'Top Riders - Distance',
    valueType: 'distance',
    users: generateUsers(20, [50, 250]),
  },
  rides_trips: {
    category: 'rides_trips',
    title: 'Top Riders - Trips',
    valueType: 'trips',
    users: generateUsers(20, [10, 80]),
  },
  walks_distance: {
    category: 'walks_distance',
    title: 'Top Walkers - Distance',
    valueType: 'distance',
    users: generateUsers(20, [20, 120]),
  },
  walks_trips: {
    category: 'walks_trips',
    title: 'Top Walkers - Trips',
    valueType: 'trips',
    users: generateUsers(20, [15, 100]),
  },
  male_rider: {
    category: 'male_rider',
    title: 'Top Male Riders',
    valueType: 'distance',
    users: generateUsers(20, [40, 220], { gender: 'male' }),
  },
  female_rider: {
    category: 'female_rider',
    title: 'Top Female Riders',
    valueType: 'distance',
    users: generateUsers(20, [35, 200], { gender: 'female' }),
  },
  new_male_rider: {
    category: 'new_male_rider',
    title: 'Top New Male Riders',
    valueType: 'distance',
    users: generateUsers(20, [15, 80], { gender: 'male', isNew: true }),
  },
  new_female_rider: {
    category: 'new_female_rider',
    title: 'Top New Female Riders',
    valueType: 'distance',
    users: generateUsers(20, [12, 75], { gender: 'female', isNew: true }),
  },
};

// Generate month options (last 12 months + All Time)
export const generateMonthOptions = (): MonthOption[] => {
  const options: MonthOption[] = [
    { value: null, label: 'All Time' },
  ];

  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }

  return options;
};

// Current user ID for highlighting
export const CURRENT_USER_ID = 'user-5-current';

// Helper to get leaderboard data with current user injected at a specific rank
export const getLeaderboardWithCurrentUser = (
  category: string,
  currentUserRank: number = 5
): LeaderboardUser[] => {
  const data = mockLeaderboardData[category];
  if (!data) return [];

  const users = [...data.users];

  // Replace user at currentUserRank position with "current user"
  if (currentUserRank > 0 && currentUserRank <= users.length) {
    const existingUser = users[currentUserRank - 1];
    users[currentUserRank - 1] = {
      ...existingUser,
      id: CURRENT_USER_ID,
      firstName: 'You',
      lastName: '',
    };
  }

  return users;
};
