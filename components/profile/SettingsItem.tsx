import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { ChevronRightIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';

interface SettingsItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  rightElement?: React.ReactNode;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  rightElement,
  toggleValue,
  onToggleChange,
  isFirst = false,
  isLast = false,
}) => {
  const { colors, isDark } = useTheme();

  const content = (
    <>
      {/* Icon */}
      {icon && <View style={styles.iconContainer}>{icon}</View>}

      {/* Text Content */}
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right Element */}
      {toggleValue !== undefined && onToggleChange ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggleChange}
          trackColor={{ false: colors.border, true: colors.primary + '60' }}
          thumbColor={toggleValue ? colors.primary : colors.backgroundSecondary}
          ios_backgroundColor={colors.border}
        />
      ) : rightElement ? (
        rightElement
      ) : showChevron ? (
        <ChevronRightIcon size={20} color={colors.textSecondary} />
      ) : null}
    </>
  );

  if (onPress && !onToggleChange) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.container,
          { backgroundColor: colors.card },
          isFirst && styles.firstItem,
          isLast && styles.lastItem,
          !isLast && [styles.borderBottom, { borderBottomColor: colors.border }],
          styles.buttonShadow,
        ]}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card },
        isFirst && styles.firstItem,
        isLast && styles.lastItem,
        !isLast && [styles.borderBottom, { borderBottomColor: colors.border }],
      ]}
    >
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  firstItem: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  lastItem: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
  },
  buttonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
