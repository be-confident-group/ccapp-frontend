export type TripListRow<T> =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'trip'; key: string; trip: T; index: number };

/** Interleaves month/year section headers into a newest-first list of trips. */
export function buildTripRows<T extends { id: string; startTime: Date }>(trips: T[]): TripListRow<T>[] {
  const rows: TripListRow<T>[] = [];
  let lastMonth = '';
  trips.forEach((trip, index) => {
    const monthKey = `${trip.startTime.getFullYear()}-${trip.startTime.getMonth()}`;
    if (monthKey !== lastMonth) {
      lastMonth = monthKey;
      rows.push({
        kind: 'header',
        key: `header-${monthKey}`,
        label: trip.startTime.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      });
    }
    rows.push({ kind: 'trip', key: trip.id, trip, index });
  });
  return rows;
}
