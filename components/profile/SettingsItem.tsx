import React from 'react';
import { View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ChevronRightIcon } from 'react-native-heroicons/mini';
import { useTheme } from '@/contexts/ThemeContext';

const TILE_SIZE = 30;
const ROW_PADDING = 16;
const ICON_GAP = 12;

interface SettingsItemProps {
  /** Icon node. With `iconColor` it is wrapped in a coloured rounded-square tile (iOS Settings style). */
  icon?: React.ReactNode;
  /** Tile background colour. Omit to render `icon` as-is (legacy look / custom leading such as an avatar). */
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  /** Trailing value text, shown before the chevron (e.g. the current language). */
  value?: string;
  /** Rendered full-width below the title row (e.g. a segmented control). */
  bottomElement?: React.ReactNode;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  /** Colour of the toggle's "on" track. */
  toggleColor?: string;
  titleColor?: string;
  /** Larger, semibold title (account row). */
  emphasis?: boolean;
  /** Centre the title (e.g. "Log out"). */
  centered?: boolean;
  /** Left inset of the hairline separator. */
  separatorInset?: number;
  /** Rendered inside a group card that supplies the background and corner radius. */
  grouped?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showChevron = true,
  rightElement,
  value,
  bottomElement,
  toggleValue,
  onToggleChange,
  toggleColor,
  titleColor,
  emphasis = false,
  centered = false,
  separatorInset,
  grouped = false,
  isFirst = false,
  isLast = false,
}) => {
  const { colors } = useTheme();

  const hasToggle = toggleValue !== undefined && !!onToggleChange;
  const pressable = !!onPress && !hasToggle;
  const inset = separatorInset ?? (icon && iconColor ? ROW_PADDING + TILE_SIZE + ICON_GAP : ROW_PADDING);

  const leading = icon ? (
    iconColor ? (
      <View style={[styles.tile, { backgroundColor: iconColor }]}>{icon}</View>
    ) : (
      <View style={styles.iconContainer}>{icon}</View>
    )
  ) : null;

  const trailing = hasToggle ? (
    <Switch
      value={toggleValue}
      onValueChange={onToggleChange}
      trackColor={{ false: colors.border, true: toggleColor ?? colors.trackingActive }}
      ios_backgroundColor={colors.border}
    />
  ) : rightElement ? (
    rightElement
  ) : (
    <View style={styles.trailing}>
      {value ? (
        <Text style={[styles.value, { color: colors.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron && pressable ? <ChevronRightIcon size={20} color={colors.textSecondary} /> : null}
    </View>
  );

  const renderBody = (pressed: boolean) => (
    <View
      style={[
        !grouped && { backgroundColor: colors.card },
        !grouped && isFirst && styles.firstItem,
        !grouped && isLast && styles.lastItem,
        pressed && { backgroundColor: colors.glassHighlight },
      ]}
    >
      <View style={[styles.row, emphasis && styles.rowEmphasis, centered && styles.rowCentered]}>
        {leading}
        <View style={[styles.textContainer, centered && styles.textCentered]}>
          <Text
            style={[
              styles.title,
              emphasis && styles.titleEmphasis,
              { color: titleColor ?? colors.text },
              centered && styles.textCenter,
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, { color: colors.textSecondary }, centered && styles.textCenter]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {centered ? null : trailing}
      </View>
      {bottomElement ? <View style={styles.bottom}>{bottomElement}</View> : null}
      {!isLast ? (
        <View
          pointerEvents="none"
          style={[styles.separator, { left: inset, backgroundColor: colors.border }]}
        />
      ) : null}
    </View>
  );

  if (pressable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        onPressIn={() => {
          if (process.env.EXPO_OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }}
      >
        {({ pressed }) => renderBody(pressed)}
      </Pressable>
    );
  }

  return renderBody(false);
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: ROW_PADDING,
    minHeight: 52,
  },
  rowEmphasis: {
    minHeight: 64,
  },
  rowCentered: {
    justifyContent: 'center',
  },
  firstItem: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  lastItem: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  separator: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: ICON_GAP,
  },
  iconContainer: {
    marginRight: ICON_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  textCentered: {
    flex: 0,
  },
  textCenter: {
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
  },
  titleEmphasis: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    flexShrink: 1,
  },
  value: {
    fontSize: 16,
    flexShrink: 1,
  },
  bottom: {
    paddingHorizontal: ROW_PADDING,
    paddingBottom: 12,
  },
});
