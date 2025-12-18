import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';

interface ProfileAvatarProps {
  imageUri?: string;
  firstName?: string;
  lastName?: string;
  onImageChange?: (uri: string) => void;
  size?: number;
  editable?: boolean;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  imageUri,
  firstName = 'User',
  lastName = '',
  onImageChange,
  size = 120,
  editable = true,
}) => {
  const { colors, isDark } = useTheme();
  const [localImageUri, setLocalImageUri] = useState(imageUri);

  // Sync local state with prop changes
  useEffect(() => {
    console.log('[ProfileAvatar] Received imageUri:', imageUri);
    setLocalImageUri(imageUri);
  }, [imageUri]);

  const getInitials = () => {
    const firstInitial = firstName?.charAt(0).toUpperCase() || 'U';
    const lastInitial = lastName?.charAt(0).toUpperCase() || '';
    return `${firstInitial}${lastInitial}`;
  };

  const pickImage = async () => {
    if (!editable) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
        return;
      }

      // Launch image picker with base64 option
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true, // Get base64 data directly
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        
        // If base64 is available, create data URI, otherwise just use URI
        if (asset.base64) {
          // Determine mime type from uri
          const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
          const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
          const base64Uri = `data:${mimeType};base64,${asset.base64}`;
          
          setLocalImageUri(uri); // Display the local URI
          onImageChange?.(base64Uri); // Pass base64 data URI to parent
        } else {
          setLocalImageUri(uri);
          onImageChange?.(uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={pickImage}
        disabled={!editable}
        activeOpacity={0.8}
        style={[
          styles.avatarContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        {localImageUri ? (
          <Image
            source={{ uri: localImageUri }}
            style={[
              styles.avatarImage,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 4,
                borderColor: colors.card,
              },
            ]}
            onError={(error) => {
              console.error('[ProfileAvatar] Failed to load image:', localImageUri, error.nativeEvent);
            }}
            onLoad={() => {
              console.log('[ProfileAvatar] Image loaded successfully:', localImageUri);
            }}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.primary,
                borderWidth: 4,
                borderColor: colors.card,
              },
            ]}
          >
            <Text
              style={[
                styles.initialsText,
                {
                  fontSize: size * 0.4,
                  color: '#FFFFFF',
                },
              ]}
            >
              {getInitials()}
            </Text>
          </View>
        )}

        {editable && (
          <View
            style={[
              styles.editButton,
              {
                backgroundColor: colors.primary,
                borderWidth: 3,
                borderColor: colors.background,
              },
              styles.editButtonShadow,
            ]}
          >
            <CameraIcon size={18} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarImage: {
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '700',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
