import React, { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NavigationRoute, ParamListBase } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { BorderRadius } from '@/constants/theme';
import {
  TAB_BAR_ACTION_SIZE,
  TAB_BAR_COLLAPSED_HEIGHT,
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN,
  TAB_BAR_SPRING,
  useTabBar,
  useTabBarBottomOffset,
} from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';

const MARGIN = TAB_BAR_MARGIN;
// Space between the action bubble and the tab pill.
const GAP = 10;
const ACTION_SIZE = TAB_BAR_ACTION_SIZE;
// Inset of the tab cells (and active bubble) inside the pill.
const PADDING = 5;
const ICON_SIZE = 24;
const LABEL_HEIGHT = 14;
const LABEL_GAP = 3;
// Half the label block: how far the icon moves to be centred once the label is gone.
const LABEL_OFFSET = (LABEL_HEIGHT + LABEL_GAP) / 2;
// Minimized pill size relative to expanded. Only transforms/opacity are animated
// so the native glass view is never resized per frame (resizing it flickers).
const COLLAPSED_SCALE = TAB_BAR_COLLAPSED_HEIGHT / TAB_BAR_HEIGHT;

// Slightly bouncier than the bar spring so the bubble feels liquid.
const BUBBLE_SPRING = { damping: 16, stiffness: 200, mass: 0.9 };
const PRESS_SPRING = { damping: 15, stiffness: 400 };

type Route = NavigationRoute<ParamListBase, string>;

interface GlassTabBarProps extends BottomTabBarProps {
  /** Route rendered as the floating action bubble instead of a regular tab. */
  actionRouteName?: string;
}

/**
 * Floating Liquid Glass tab bar: an action bubble on the left and a pill of
 * tabs on the right. A highlight springs to the active tab. While the user
 * scrolls down (via `useTabBarScrollHandler`), the action bubble shrinks away
 * and the pill minimizes and glides to the centre.
 */
export function GlassTabBar({ state, descriptors, navigation, actionRouteName }: GlassTabBarProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { collapse, setCollapsed } = useTabBar();
  const bottom = useTabBarBottomOffset();

  const actionRoute = state.routes.find((r) => r.name === actionRouteName);
  const tabRoutes = state.routes.filter((r) => r.name !== actionRouteName);
  const focusedKey = state.routes[state.index]?.key;
  const activeIndex = Math.max(0, tabRoutes.findIndex((r) => r.key === focusedKey));

  const actionSpace = actionRoute ? ACTION_SIZE + GAP : 0;
  const pillWidth = width - MARGIN * 2 - actionSpace;
  const tabWidth = (pillWidth - PADDING * 2) / tabRoutes.length;
  // Shift that moves the pill from the right of the action bubble to screen centre.
  const centerShift = -actionSpace / 2;

  const position = useSharedValue(activeIndex);
  useEffect(() => {
    position.value = withSpring(activeIndex, BUBBLE_SPRING);
  }, [activeIndex, position]);

  const pillStyle = useAnimatedStyle(() => {
    const scale = interpolate(collapse.value, [0, 1], [1, COLLAPSED_SCALE]);
    return {
      transform: [
        { translateX: interpolate(collapse.value, [0, 1], [0, centerShift]) },
        // Keep the bottom edge anchored while shrinking.
        { translateY: (TAB_BAR_HEIGHT * (1 - scale)) / 2 },
        { scale },
      ],
    };
  });

  const highlightStyle = useAnimatedStyle(() => {
    // 0 when resting on a tab, 0.5 halfway between two: stretch the highlight in flight.
    const travel = Math.abs(position.value - Math.round(position.value));
    return {
      transform: [
        { translateX: position.value * tabWidth },
        { scaleX: 1 + travel * 0.5 },
        { scaleY: 1 - travel * 0.15 },
      ],
    };
  });

  const pressRoute = (route: Route, focused: boolean) => {
    setCollapsed(false);
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const longPressRoute = (route: Route) => {
    navigation.emit({ type: 'tabLongPress', target: route.key });
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom, paddingHorizontal: MARGIN }]}>
      {actionRoute && (
        <ActionBubble
          options={descriptors[actionRoute.key].options}
          collapse={collapse}
          onPress={() => pressRoute(actionRoute, false)}
          onLongPress={() => longPressRoute(actionRoute)}
        />
      )}

      <Animated.View
        style={[styles.pill, { width: pillWidth, shadowColor: colors.shadow }, pillStyle]}
      >
        <GlassSurface borderRadius={BorderRadius.full} interactive />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { width: tabWidth, backgroundColor: colors.glassHighlight },
            highlightStyle,
          ]}
        />
        {tabRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedKey;
          return (
            <TabItem
              key={route.key}
              options={options}
              label={typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name}
              focused={focused}
              collapse={collapse}
              onPress={() => pressRoute(route, focused)}
              onLongPress={() => longPressRoute(route)}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

interface ItemProps {
  options: BottomTabNavigationOptions;
  collapse: SharedValue<number>;
  onPress: () => void;
  onLongPress: () => void;
}

/**
 * Press-in feedback shared by all bar items: a spring scale plus a haptic tap
 * on touch-down (as native iOS bars do), so it responds before release.
 */
function usePressFeedback(haptic: Haptics.ImpactFeedbackStyle) {
  const scale = useSharedValue(1);
  return {
    scale,
    onPressIn: () => {
      scale.value = withSpring(0.86, PRESS_SPRING);
      if (process.env.EXPO_OS !== 'web') {
        Haptics.impactAsync(haptic);
      }
    },
    onPressOut: () => {
      scale.value = withSpring(1, PRESS_SPRING);
    },
  };
}

function TabItem({ options, label, focused, collapse, onPress, onLongPress }: ItemProps & { label: string; focused: boolean }) {
  const { colors } = useTheme();
  const press = usePressFeedback(Haptics.ImpactFeedbackStyle.Light);

  // Small "pop" when a tab becomes active.
  const pop = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      pop.value = withSequence(withSpring(1.18, PRESS_SPRING), withSpring(1, TAB_BAR_SPRING));
    }
  }, [focused, pop]);

  // As the label fades out, slide the icon down to the vertical centre.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(collapse.value, [0, 1], [0, LABEL_OFFSET]) },
      { scale: press.scale.value * pop.value * interpolate(collapse.value, [0, 1], [1, 1.08]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(collapse.value, [0, 1], [0, LABEL_OFFSET]) },
      { scale: interpolate(collapse.value, [0, 1], [1, 0.7]) },
    ],
  }));

  const color = focused ? colors.glassTint : colors.glassInactive;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
      testID={options.tabBarButtonTestID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
      </Animated.View>
      <Animated.Text numberOfLines={1} style={[styles.label, { color }, labelStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * Glass circle holding the quick-action "+". On scroll it spins and shrinks
 * away towards the screen edge; it springs back when the bar expands.
 */
function ActionBubble({ options, collapse, onPress, onLongPress }: ItemProps) {
  const { colors } = useTheme();
  const press = usePressFeedback(Haptics.ImpactFeedbackStyle.Medium);

  const bubbleStyle = useAnimatedStyle(() => ({
    // Scale to (almost) zero instead of fading: GlassView stops rendering at opacity 0.
    transform: [
      { translateX: interpolate(collapse.value, [0, 1], [0, -ACTION_SIZE / 3]) },
      { scale: press.scale.value * interpolate(collapse.value, [0, 0.8], [1, 0.01], Extrapolation.CLAMP) },
      { rotate: `${interpolate(collapse.value, [0, 1], [0, -90])}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.actionWrap, { shadowColor: colors.shadow }, bubbleStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.action}
      >
        <GlassSurface borderRadius={ACTION_SIZE / 2} interactive />
        {options.tabBarIcon?.({ focused: false, color: colors.glassTint, size: ICON_SIZE + 4 })}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    borderRadius: BorderRadius.full,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  highlight: {
    position: 'absolute',
    left: PADDING,
    top: PADDING,
    bottom: PADDING,
    borderRadius: BorderRadius.full,
  },
  item: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: LABEL_GAP,
    fontSize: 11,
    lineHeight: LABEL_HEIGHT,
    fontWeight: '600',
  },
  actionWrap: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
