import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';

interface UserAvatarProps {
  imageUri?: string;
  name: string;
  size?: number;
}

export const UserAvatar = React.memo(function UserAvatar({ imageUri, name, size = 44 }: UserAvatarProps) {
  const { colors } = useTheme();

  const getInitials = (fullName: string): string => {
    const names = fullName.trim().split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return fullName.slice(0, 2).toUpperCase();
  };

  const dynamicStyles = {
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    initials: {
      fontSize: size * 0.4,
    },
  };

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.image, dynamicStyles.container]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        dynamicStyles.container,
        { backgroundColor: colors.primary },
      ]}
    >
      <ThemedText style={[styles.initials, dynamicStyles.initials]}>
        {getInitials(name)}
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
