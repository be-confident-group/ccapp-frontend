import React, { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

interface FadeInUpProps {
  children: ReactNode;
  /** Position in the list, used to stagger the entrance. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}

/** Staggered fade + slide-up entrance. Only wrap non-glass content (opacity starts at 0). */
export function FadeInUp({ children, index = 0, style }: FadeInUpProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      Math.min(index, 10) * 60,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 16 }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
