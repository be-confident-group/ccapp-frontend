import { BoltIcon, LifebuoyIcon, TruckIcon, UserIcon } from 'react-native-heroicons/outline';

import type { TripType } from '@/types/trip';

/** Heroicon used for each trip type (shared by trip lists, detail and manual entry). */
export const TRIP_TYPE_ICONS: Record<TripType, typeof UserIcon> = {
  walk: UserIcon,
  run: BoltIcon,
  cycle: LifebuoyIcon,
  drive: TruckIcon,
};
