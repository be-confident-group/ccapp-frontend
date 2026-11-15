import { Platform } from 'react-native';

const material = Platform.OS === 'android';

/**
 * Spring presets for `withSpring`. Always use one of these instead of an
 * inline config: Reanimated 4 defaults `mass` to 4, so a config that only sets
 * `damping` and `stiffness` wobbles for seconds.
 *
 * Android uses the Material 3 Expressive motion scheme (spatial springs
 * overshoot a little, effect springs never do); iOS keeps a livelier bounce
 * to match Liquid Glass.
 */
export const Springs = {
  /** Press feedback: scaling a control under the finger. */
  press: material ? { mass: 1, stiffness: 800, damping: 34 } : { mass: 1, stiffness: 400, damping: 15 },
  /** Anything that moves or resizes: indicators, bars, menus, sheets. */
  spatial: material ? { mass: 1, stiffness: 380, damping: 31 } : { mass: 0.9, stiffness: 200, damping: 16 },
  /** Opacity and colour changes: critically damped, never overshoots. */
  effect: { mass: 1, stiffness: 1600, damping: 80 },
};
