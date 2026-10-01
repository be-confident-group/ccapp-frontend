import React, { createContext, ReactNode, useCallback, useContext, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating tab bar pill when fully expanded. */
export const TAB_BAR_HEIGHT = 64;
/** Height of the pill when minimized on scroll. */
export const TAB_BAR_COLLAPSED_HEIGHT = 52;
/** Horizontal screen margin of the bar. */
export const TAB_BAR_MARGIN = 16;
/** Diameter of the quick-action bubble left of the pill (as tall as the pill). */
export const TAB_BAR_ACTION_SIZE = TAB_BAR_HEIGHT;

/** Shared spring used by the tab bar so every transition feels the same. */
export const TAB_BAR_SPRING = { damping: 20, stiffness: 240, mass: 0.8 };

// Scroll distance from the top within which the bar always stays expanded.
const TOP_THRESHOLD = 24;
// Minimum per-event scroll delta before we change state, to ignore jitter.
const DOWN_DELTA = 4;
const UP_DELTA = 6;

interface TabBarContextType {
  /** 0 = expanded, 1 = minimized. Animated on the UI thread. */
  collapse: SharedValue<number>;
  /** The state `collapse` is springing towards; avoids re-triggering springs. */
  target: SharedValue<number>;
}

const TabBarContext = createContext<TabBarContextType | undefined>(undefined);

export function TabBarProvider({ children }: { children: ReactNode }) {
  const collapse = useSharedValue(0);
  const target = useSharedValue(0);
  const value = useMemo(() => ({ collapse, target }), [collapse, target]);

  return <TabBarContext.Provider value={value}>{children}</TabBarContext.Provider>;
}

export function useTabBar() {
  const context = useContext(TabBarContext);
  if (!context) {
    throw new Error('useTabBar must be used within a TabBarProvider');
  }

  const { collapse, target } = context;

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      const next = collapsed ? 1 : 0;
      if (target.value === next) return;
      target.value = next;
      collapse.value = withSpring(next, TAB_BAR_SPRING);
    },
    [collapse, target]
  );

  return { ...context, setCollapsed };
}

/**
 * Scroll handler for tab screens: minimizes the floating tab bar while
 * scrolling down and restores it on scroll up or near the top.
 * Attach to an `Animated.ScrollView` / `Animated.FlatList` via `onScroll`
 * together with `scrollEventThrottle={16}`.
 * Pass `scrollY` to also track the scroll offset for screen-level effects
 * (a screen can only attach one animated scroll handler).
 */
export function useTabBarScrollHandler(scrollY?: SharedValue<number>) {
  const { collapse, target, setCollapsed } = useTabBar();

  // Each tab keeps its own scroll position, so always show the full bar on focus.
  useFocusEffect(
    useCallback(() => {
      setCollapsed(false);
    }, [setCollapsed])
  );

  return useAnimatedScrollHandler<{ lastY?: number }>({
    onScroll: (event, ctx) => {
      const y = event.contentOffset.y;
      if (scrollY) scrollY.value = y;
      const maxY = event.contentSize.height - event.layoutMeasurement.height;
      const dy = y - (ctx.lastY ?? y);
      ctx.lastY = y;

      // Ignore rubber-band overscroll at the bottom so the bounce doesn't expand the bar.
      if (y > maxY && maxY > 0) return;

      let next = target.value;
      if (y <= TOP_THRESHOLD) next = 0;
      else if (dy > DOWN_DELTA) next = 1;
      else if (dy < -UP_DELTA) next = 0;

      if (next !== target.value) {
        target.value = next;
        collapse.value = withSpring(next, TAB_BAR_SPRING);
      }
    },
  });
}

/** Distance between the bottom of the screen and the bottom of the tab bar pill. */
export function useTabBarBottomOffset() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom - 10, 12);
}

/** Bottom padding a scrollable tab screen needs so content clears the floating bar. */
export function useTabBarInset() {
  return useTabBarBottomOffset() + TAB_BAR_HEIGHT + 16;
}
