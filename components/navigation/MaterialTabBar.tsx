import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import type { NavigationRoute, ParamListBase } from '@react-navigation/native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Springs } from '@/constants/motion';
import {
  TAB_BAR_ACTION_RADIUS,
  TAB_BAR_ACTION_SIZE,
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN,
  useTabBar,
} from '@/contexts/TabBarContext';
import { useTheme } from '@/contexts/ThemeContext';

const ICON_SIZE = 24;
const INDICATOR_WIDTH = 56;
const INDICATOR_HEIGHT = 32;
const FAB_GAP = 16;
// The FAB rounds further while pressed (Material 3 Expressive shape morph).
const FAB_PRESSED_RADIUS = 28;

type Route = NavigationRoute<ParamListBase, string>;

interface MaterialTabBarProps extends BottomTabBarProps {
  /** Route rendered as the floating action button instead of a destination. */
  actionRouteName?: string;
  /** Destination whose own controls would collide with the FAB (the map's bottom sheet). */
  actionHiddenOnRoute?: string;
}

/**
 * Material 3 navigation bar for Android: destinations docked to the bottom
 * edge with a pill indicator behind the active icon, and the quick-action
 * route as a FAB above the bar. The FAB scales away while the user scrolls
 * down (via `useTabBarScrollHandler`) so it never covers content being read.
 */
export function MaterialTabBar({ state, descriptors, navigation, actionRouteName, actionHiddenOnRoute }: MaterialTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { setCollapsed } = useTabBar();

  const actionRoute = state.routes.find((r) => r.name === actionRouteName);
  const tabRoutes = state.routes.filter((r) => r.name !== actionRouteName);
  const focusedKey = state.routes[state.index]?.key;

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
    <View pointerEvents="box-none" style={styles.wrapper}>
      {actionRoute && (
        <Fab
          options={descriptors[actionRoute.key].options}
          hidden={state.routes[state.index]?.name === actionHiddenOnRoute}
          onPress={() => pressRoute(actionRoute, false)}
          onLongPress={() => longPressRoute(actionRoute)}
        />
      )}
      <View
        accessibilityRole="tablist"
        style={[styles.bar, { backgroundColor: colors.backgroundSecondary, paddingBottom: insets.bottom }]}
      >
        {tabRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedKey;
          return (
            <Destination
              key={route.key}
              options={options}
              label={typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name}
              focused={focused}
              onPress={() => pressRoute(route, focused)}
              onLongPress={() => longPressRoute(route)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface ItemProps {
  options: BottomTabNavigationOptions;
  onPress: () => void;
  onLongPress: () => void;
}

function Destination({ options, label, focused, onPress, onLongPress }: ItemProps & { label: string; focused: boolean }) {
  const { colors } = useTheme();

  const active = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, Springs.spatial);
  }, [focused, active]);

  // The indicator grows out sideways from the icon's centre.
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(active.value, [0, 1], [0.35, 1]) }],
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
      android_ripple={{ color: colors.glassHighlight, borderless: true, radius: 44 }}
      style={styles.item}
    >
      <View style={styles.iconSlot}>
        <Animated.View style={[styles.indicator, { backgroundColor: colors.glassHighlight }, indicatorStyle]} />
        {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
      </View>
      <Text
        numberOfLines={1}
        style={[styles.label, focused && styles.labelActive, { color: focused ? colors.text : colors.glassInactive }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Fab({ options, hidden, onPress, onLongPress }: ItemProps & { hidden: boolean }) {
  const { colors } = useTheme();
  const { collapse } = useTabBar();
  const pressed = useSharedValue(0);

  const present = useSharedValue(hidden ? 0 : 1);
  useEffect(() => {
    present.value = withSpring(hidden ? 0 : 1, Springs.spatial);
  }, [hidden, present]);

  const style = useAnimatedStyle(() => {
    const shown = present.value * interpolate(collapse.value, [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: shown,
      borderRadius: interpolate(pressed.value, [0, 1], [TAB_BAR_ACTION_RADIUS, FAB_PRESSED_RADIUS]),
      transform: [{ scale: shown * interpolate(pressed.value, [0, 1], [1, 0.94]) }],
    };
  });

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[styles.fab, { backgroundColor: colors.glassActiveFill }, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => {
          pressed.value = withSpring(1, Springs.press);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, Springs.press);
        }}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.24)' }}
        style={styles.fabContent}
      >
        {options.tabBarIcon?.({ focused: false, color: '#FFFFFF', size: ICON_SIZE })}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconSlot: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
  },
  fab: {
    alignSelf: 'flex-end',
    width: TAB_BAR_ACTION_SIZE,
    height: TAB_BAR_ACTION_SIZE,
    marginRight: TAB_BAR_MARGIN,
    marginBottom: FAB_GAP,
    overflow: 'hidden',
    elevation: 6,
  },
  fabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
