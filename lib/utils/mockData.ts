// Mock data for development and testing

export const mockStats = {
  totalDistance: {
    value: '125.5',
    unit: 'km',
    label: 'Total Distance',
  },
  totalRides: {
    value: '42',
    label: 'Total Rides',
  },
  co2Saved: {
    value: '15.2',
    unit: 'kg',
    label: 'CO2 Saved',
  },
  currentStreak: {
    value: '7',
    unit: 'days',
    label: 'Current Streak',
  },
};

export const mockDetailedStats = {
  thisWeek: {
    distance: 32.5,
    rides: 8,
    avgSpeed: 18.5,
    duration: 450, // minutes
  },
  thisMonth: {
    distance: 125.5,
    rides: 42,
    avgSpeed: 17.2,
    duration: 1820,
  },
  allTime: {
    distance: 542.8,
    rides: 156,
    avgSpeed: 16.8,
    duration: 7240,
    co2Saved: 65.4,
  },
};

export const mockBadges = [
  {
    id: '1',
    name: 'First Ride',
    description: 'Complete your first ride',
    icon: '🚴',
    earned: true,
    earnedDate: '2024-01-15',
  },
  {
    id: '2',
    name: 'Week Warrior',
    description: 'Ride 7 days in a row',
    icon: '🔥',
    earned: true,
    earnedDate: '2024-02-01',
  },
  {
    id: '3',
    name: 'Century',
    description: 'Ride 100km total',
    icon: '💯',
    earned: true,
    earnedDate: '2024-02-20',
  },
  {
    id: '4',
    name: 'Eco Champion',
    description: 'Save 10kg of CO2',
    icon: '🌱',
    earned: true,
    earnedDate: '2024-03-05',
  },
  {
    id: '5',
    name: 'Half Century',
    description: 'Complete 50 rides',
    icon: '🏆',
    earned: false,
    progress: 42,
    target: 50,
  },
  {
    id: '6',
    name: 'Speed Demon',
    description: 'Average 25km/h on a ride',
    icon: '⚡',
    earned: false,
    progress: 0,
    target: 1,
  },
];

export const mockGoals = [
  {
    id: '1',
    title: 'Ride 50km this week',
    type: 'distance',
    target: 50,
    current: 32.5,
    unit: 'km',
    deadline: '2024-10-13',
    active: true,
  },
  {
    id: '2',
    title: 'Complete 10 rides this month',
    type: 'rides',
    target: 10,
    current: 8,
    unit: 'rides',
    deadline: '2024-10-31',
    active: true,
  },
  {
    id: '3',
    title: 'Save 5kg CO2 this month',
    type: 'co2',
    target: 5,
    current: 3.2,
    unit: 'kg',
    deadline: '2024-10-31',
    active: true,
  },
  {
    id: '4',
    title: 'Ride 1000km total',
    type: 'distance',
    target: 1000,
    current: 542.8,
    unit: 'km',
    deadline: null,
    active: true,
  },
];
