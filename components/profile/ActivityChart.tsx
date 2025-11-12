import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { Circle, useFont } from '@shopify/react-native-skia';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';

type TimeRange = 'month' | '6months' | 'year';

interface DataPoint {
  day: number;
  distance: number;
}

interface ActivityChartProps {
  data?: { month: DataPoint[]; '6months': DataPoint[]; year: DataPoint[] };
}

// Mock data generator for demonstration
const generateMockData = (): {
  month: DataPoint[];
  '6months': DataPoint[];
  year: DataPoint[];
} => {
  const monthData: DataPoint[] = [];
  const sixMonthsData: DataPoint[] = [];
  const yearData: DataPoint[] = [];

  // Generate month data (30 days)
  for (let i = 0; i < 30; i++) {
    monthData.push({
      day: i + 1,
      distance: Math.floor(Math.random() * 30) + 5,
    });
  }

  // Generate 6 months data (26 weeks)
  for (let i = 0; i < 26; i++) {
    sixMonthsData.push({
      day: i + 1,
      distance: Math.floor(Math.random() * 120) + 20,
    });
  }

  // Generate year data (12 months)
  for (let i = 0; i < 12; i++) {
    yearData.push({
      day: i + 1,
      distance: Math.floor(Math.random() * 400) + 50,
    });
  }

  return { month: monthData, '6months': sixMonthsData, year: yearData };
};

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  const { colors, isDark } = useTheme();
  const [selectedRange, setSelectedRange] = useState<TimeRange>('month');
  const chartData = useMemo(() => data || generateMockData(), [data]);
  const { state, isActive } = useChartPressState({ x: 0, y: { distance: 0 } });

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64;

  const tabs: { key: TimeRange; label: string }[] = [
    { key: 'month', label: 'Month' },
    { key: '6months', label: '6 Months' },
    { key: 'year', label: 'Year' },
  ];

  const currentData = chartData[selectedRange];
  const totalDistance = currentData.reduce((sum, d) => sum + d.distance, 0);
  const avgDistance = totalDistance / currentData.length;
  const bestDay = Math.max(...currentData.map((d) => d.distance));

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: colors.backgroundSecondary }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setSelectedRange(tab.key)}
            style={[
              styles.tab,
              selectedRange === tab.key && [styles.activeTab, { backgroundColor: colors.card }],
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selectedRange === tab.key ? colors.primary : colors.textSecondary,
                  fontWeight: selectedRange === tab.key ? '600' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chart Title */}
      <View style={styles.chartHeader}>
        <ThemedText style={[styles.chartTitle, { color: colors.text }]}>
          Bike Distance (km)
        </ThemedText>
        {isActive && (
          <Text style={[styles.activeValue, { color: colors.primary }]}>
            Day {state.x.value.value.toFixed(0)}: {state.y.distance.value.value.toFixed(1)} km
          </Text>
        )}
      </View>

      {/* Chart */}
      <View style={styles.chartContainer}>
        <CartesianChart
          data={currentData}
          xKey="day"
          yKeys={['distance']}
          chartPressState={state}
          padding={{ left: 10, right: 10, top: 10, bottom: 10 }}
          domainPadding={{ left: 20, right: 20, top: 20, bottom: 20 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Line
                points={points.distance}
                color={colors.primary}
                strokeWidth={3}
                curveType="catmullRom"
                animate={{ type: 'timing', duration: 300 }}
              />
              {isActive && (
                <Circle
                  cx={state.x.position}
                  cy={state.y.distance.position}
                  r={8}
                  color={colors.primary}
                  opacity={0.8}
                />
              )}
            </>
          )}
        </CartesianChart>
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
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg km/day</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {bestDay.toFixed(0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best day</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
  },
  chartHeader: {
    marginBottom: 12,
    paddingLeft: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    height: 200,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 8,
  },
});
