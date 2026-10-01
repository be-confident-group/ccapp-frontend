import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  Easing,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import {
  BoltIcon,
  FireIcon,
  FlagIcon,
  GlobeEuropeAfricaIcon,
  LockClosedIcon,
  MapIcon,
} from 'react-native-heroicons/solid';

import { useTheme } from '@/contexts/ThemeContext';
import type { Trophy, TrophyType } from '@/lib/api/trophies';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

/** Per-type look: icon, gradient (light → deep) and how the target is abbreviated. */
const TYPE_STYLES: Record<TrophyType, { icon: IconComponent; colors: [string, string]; unit: string }> = {
  trip_count: { icon: FlagIcon, colors: ['#7DB4FF', '#2457D6'], unit: '' },
  distance: { icon: MapIcon, colors: ['#4FE0CC', '#0B7A6E'], unit: 'km' },
  streak: { icon: FireIcon, colors: ['#FFC37A', '#E2550B'], unit: 'd' },
  speed: { icon: BoltIcon, colors: ['#FF9FCF', '#C81E6C'], unit: '' },
  co2_saved: { icon: GlobeEuropeAfricaIcon, colors: ['#8EF0A8', '#15924A'], unit: 'kg' },
};

const FALLBACK = TYPE_STYLES.trip_count;

/** Points of a pointy-top hexagon centred in a `size` box, inset by `inset`. */
function hexPoints(size: number, inset: number) {
  const c = size / 2;
  const r = c - inset;
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${c + r * Math.cos(angle)},${c + r * Math.sin(angle)}`;
  }).join(' ');
}

interface TrophyBadgeProps {
  trophy: Pick<Trophy, 'code' | 'trophy_type' | 'threshold' | 'progress' | 'is_earned'>;
  size?: number;
  /** Show the target value on a ribbon under the medal. */
  showTarget?: boolean;
  /** Stagger index for the entrance animation in lists. */
  index?: number;
}

/**
 * Hexagonal medal drawn per trophy: colour and icon by trophy type, target on
 * a ribbon. Earned medals are a glossy gradient with a coloured glow; locked
 * ones are muted with a progress ring in the type colour and a lock.
 */
export function TrophyBadge({ trophy, size = 72, showTarget = true, index = 0 }: TrophyBadgeProps) {
  const { colors, isDark } = useTheme();
  const type = TYPE_STYLES[trophy.trophy_type] ?? FALLBACK;
  const Icon = type.icon;
  const earned = trophy.is_earned;
  const gradientId = `trophy-${trophy.code}`;

  // The ring sits just outside the medal; the medal is inset to leave room for it.
  const ringWidth = Math.max(3, size * 0.05);
  const ringRadius = size / 2 - ringWidth / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const medalInset = ringWidth + size * 0.06;
  const progress = Math.min(Math.max(trophy.progress ?? 0, 0), 100) / 100;

  const appear = useSharedValue(0);
  const ring = useSharedValue(0);
  useEffect(() => {
    appear.value = withDelay(index * 50, withSpring(1, { damping: 12, stiffness: 160 }));
    ring.value = withDelay(index * 50 + 150, withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [appear, ring, progress, index]);

  const medalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + appear.value * 0.4 }],
  }));

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - ring.value),
  }));

  const lockedFill = isDark ? ['#3A3F45', '#25292D'] : ['#EEF0F2', '#D5D9DE'];
  const [top, bottom] = earned ? type.colors : lockedFill;
  const target = `${trophy.threshold}${type.unit}`;

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Animated.View
        style={[
          { width: size, height: size },
          earned && [styles.glow, { shadowColor: type.colors[1] }],
          medalStyle,
        ]}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={top} />
              <Stop offset="1" stopColor={bottom} />
            </LinearGradient>
          </Defs>

          {!earned && (
            <>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={ringRadius}
                stroke={colors.border}
                strokeWidth={ringWidth}
                fill="none"
              />
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={ringRadius}
                stroke={type.colors[1]}
                strokeWidth={ringWidth}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                animatedProps={ringProps}
                // Start the ring at 12 o'clock.
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            </>
          )}

          {/* Rounded hexagon: a round-joined stroke in the fill softens the corners. */}
          <Polygon
            points={hexPoints(size, medalInset)}
            fill={`url(#${gradientId})`}
            stroke={`url(#${gradientId})`}
            strokeWidth={size * 0.08}
            strokeLinejoin="round"
          />
          {/* Inner bevel line for a minted look. */}
          <Polygon
            points={hexPoints(size, medalInset + size * 0.08)}
            fill="none"
            stroke={earned ? 'rgba(255,255,255,0.45)' : colors.border}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>

        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.iconCenter}>
            <Icon size={size * 0.34} color={earned ? '#FFFFFF' : colors.glassInactive} />
          </View>
          {!earned && (
            <View
              style={[
                styles.lock,
                {
                  width: size * 0.3,
                  height: size * 0.3,
                  borderRadius: size * 0.15,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <LockClosedIcon size={size * 0.15} color={colors.glassInactive} />
            </View>
          )}
        </View>
      </Animated.View>

      {showTarget && (
        <View
          style={[
            styles.ribbon,
            { backgroundColor: earned ? type.colors[1] : colors.backgroundSecondary, marginTop: -size * 0.12 },
          ]}
        >
          <Text
            style={[styles.ribbonText, { color: earned ? '#FFFFFF' : colors.textSecondary, fontSize: Math.max(10, size * 0.14) }]}
            numberOfLines={1}
          >
            {target}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  iconCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ribbon: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 32,
    alignItems: 'center',
  },
  ribbonText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
