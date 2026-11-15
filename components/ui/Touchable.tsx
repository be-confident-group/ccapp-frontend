import React from 'react';
import { Platform, Pressable, PressableProps, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

/**
 * Drop-in replacement for TouchableOpacity. iOS keeps the fade on press;
 * Android shows a Material ripple (state layer) instead, so `activeOpacity`
 * only applies on iOS.
 */
export const Touchable = React.forwardRef<View, TouchableOpacityProps>(function Touchable(
  { activeOpacity, style, ...props },
  ref
) {
  const { isDark } = useTheme();

  if (Platform.OS !== 'android') {
    return <TouchableOpacity ref={ref} activeOpacity={activeOpacity} style={style} {...props} />;
  }

  return (
    <Pressable
      ref={ref}
      android_ripple={{ color: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)', foreground: true }}
      // The ripple is drawn as a rectangle unless the view clips to its corners.
      style={[style, { overflow: 'hidden' }]}
      {...(props as PressableProps)}
    />
  );
});
