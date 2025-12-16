import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';
import { useTheme } from '@/contexts/ThemeContext';

type TimeRange = 'week' | 'month' | '3months';
type ActivityType = 'ride' | 'walk';

interface DataPoint {
  day: number;
  distance: number;
  walk?: number;
  ride?: number;
}

interface ActivityChartProps {
  data?: { week: DataPoint[]; month: DataPoint[]; '3months': DataPoint[] };
}

// Mock data generator for demonstration
const generateMockData = (): {
  week: DataPoint[];
  month: DataPoint[];
  '3months': DataPoint[];
} => {
  const weekData: DataPoint[] = [];
  const monthData: DataPoint[] = [];
  const threeMonthsData: DataPoint[] = [];

  // Generate week data (7 days)
  for (let i = 0; i < 7; i++) {
    const walk = Math.floor(Math.random() * 8) + 2;
    const ride = Math.floor(Math.random() * 12) + 3;
    weekData.push({
      day: i + 1,
      distance: walk + ride,
      walk,
      ride,
    });
  }

  // Generate month data (30 days)
  for (let i = 0; i < 30; i++) {
    const walk = Math.floor(Math.random() * 15) + 3;
    const ride = Math.floor(Math.random() * 20) + 5;
    monthData.push({
      day: i + 1,
      distance: walk + ride,
      walk,
      ride,
    });
  }

  // Generate 3 months data (12 weeks)
  for (let i = 0; i < 12; i++) {
    const walk = Math.floor(Math.random() * 50) + 10;
    const ride = Math.floor(Math.random() * 70) + 15;
    threeMonthsData.push({
      day: i + 1,
      distance: walk + ride,
      walk,
      ride,
    });
  }

  return { week: weekData, month: monthData, '3months': threeMonthsData };
};

const getXAxisLabel = (range: TimeRange, dayValue: number, index: number): string => {
  if (range === 'week') {
    // Show day abbreviations for week view
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[index] || '';
  } else if (range === 'month') {
    // Show specific days for month view - fewer labels to fit better
    return [1, 10, 20, 30].includes(dayValue) ? `${dayValue}` : '';
  } else {
    // 3 months view - show week numbers, every 3rd week for better spacing
    return dayValue % 3 === 0 ? `W${dayValue}` : '';
  }
};

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  const { colors } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('week');
  const [activityType, setActivityType] = useState<ActivityType>('ride');
  const chartData = useMemo(() => data || generateMockData(), [data]);
  const { state, isActive } = useChartPressState({ x: 0, y: { distance: 0 } });

  const tabs: { key: TimeRange; label: string }[] = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: '3months', label: '3 Months' },
  ];

  const currentData = chartData[selectedRange];

  // Calculate values based on activity type
  const getDistanceValue = (point: DataPoint): number => {
    if (activityType === 'walk') return point.walk || 0;
    return point.ride || 0;
  };

  const totalDistance = currentData.reduce((sum, d) => sum + getDistanceValue(d), 0);
  const avgDistance = totalDistance / currentData.length;
  const bestDay = Math.max(...currentData.map((d) => getDistanceValue(d)));

  // Calculate Y-axis labels
  const maxDistance = Math.max(...currentData.map((d) => getDistanceValue(d)));
  const yAxisMax = Math.ceil(maxDistance / 50) * 50 + 50;
  const yAxisStep = yAxisMax / 4;

  const activityTabs: { key: ActivityType; label: string; color: string }[] = [
    { key: 'ride', label: 'Ride', color: '#3B82F6' },
    { key: 'walk', label: 'Walk', color: '#F59E0B' },
  ];

  return (
    <View style={styles.container}>
      {/* Compact Header with Combined Toggles */}
      <View style={styles.header}>
        {/* Activity Type Chips */}
        <View style={styles.chipGroup}>
          {activityTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActivityType(tab.key)}
              style={[
                styles.chip,
                activityType === tab.key && [
                  styles.activeChip,
                  { backgroundColor: tab.color + '15', borderColor: tab.color },
                ],
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: activityType === tab.key ? tab.color : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time Range Minimal Toggle */}
        <View style={[styles.rangeToggle, { backgroundColor: colors.backgroundSecondary }]}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setSelectedRange(tab.key)}
              style={[
                styles.rangeTab,
                selectedRange === tab.key && [
                  styles.activeRangeTab,
                  { backgroundColor: colors.card },
                ],
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.rangeText,
                  { color: selectedRange === tab.key ? colors.text : colors.textSecondary },
                ]}
              >
                {tab.label === 'Week' ? '1W' : tab.label === 'Month' ? '1M' : '3M'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Active Value Display */}
      {isActive && (
        <View style={styles.activeValueContainer}>
          <Text style={[styles.activeValue, { color: activityTabs.find(t => t.key === activityType)?.color }]}>
            {state.y.distance.value.value.toFixed(1)} km
          </Text>
        </View>
      )}

      {/* Chart with Axes */}
      <View style={styles.chartWrapper}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {[yAxisMax, yAxisMax - yAxisStep, yAxisMax - yAxisStep * 2, yAxisMax - yAxisStep * 3, 0].map(
            (value, index) => (
              <Text
                key={index}
                style={[styles.yAxisLabel, { color: colors.textSecondary }]}
              >
                {Math.round(value)}
              </Text>
            )
          )}
        </View>

        {/* Chart Container */}
        <View style={styles.chartWithXAxis}>
          <View style={styles.chartContainer}>
            <CartesianChart
              data={currentData.map(point => ({ ...point, distance: getDistanceValue(point) }))}
              xKey="day"
              yKeys={['distance']}
              chartPressState={state}
              padding={{ left: 10, right: 10, top: 10, bottom: 10 }}
              domainPadding={{ left: 20, right: 20, top: 30, bottom: 10 }}
              domain={{ y: [0, yAxisMax] }}
            >
              {({ points }) => (
                <>
                  <Line
                    points={points.distance}
                    color={activityTabs.find(t => t.key === activityType)?.color || colors.primary}
                    strokeWidth={2}
                    curveType="catmullRom"
                    animate={{ type: 'timing', duration: 300 }}
                  />
                  {isActive && (
                    <Circle
                      cx={state.x.position}
                      cy={state.y.distance.position}
                      r={6}
                      color={activityTabs.find(t => t.key === activityType)?.color || colors.primary}
                      opacity={0.8}
                    />
                  )}
                </>
              )}
            </CartesianChart>
          </View>

          {/* X-axis labels */}
          <View style={styles.xAxisLabels}>
            {currentData.map((point, index) => {
              const label = getXAxisLabel(selectedRange, point.day, index);
              if (!label) return <View key={index} style={styles.xAxisLabelItem} />;
              return (
                <View key={index} style={styles.xAxisLabelItem}>
                  <Text style={[styles.xAxisLabel, { color: colors.textSecondary }]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalDistance.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total km</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {avgDistance.toFixed(1)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg km</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {bestDay.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chipGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeChip: {
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rangeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
  },
  rangeTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 38,
    alignItems: 'center',
  },
  activeRangeTab: {
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeValueContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  activeValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  chartWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  yAxisLabels: {
    width: 30,
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 24,
  },
  yAxisLabel: {
    fontSize: 9,
    textAlign: 'right',
  },
  chartWithXAxis: {
    flex: 1,
  },
  chartContainer: {
    height: 160,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    height: 20,
    marginTop: 4,
  },
  xAxisLabelItem: {
    flex: 1,
    alignItems: 'center',
  },
  xAxisLabel: {
    fontSize: 9,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: 6,
  },
});
