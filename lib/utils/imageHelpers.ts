/**
 * Image utility functions for handling image uploads
 */

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Request camera roll permissions
 */
export async function requestImagePermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera roll permissions to upload images!');
    return false;
  }
  return true;
}

/**
 * Pick an image from the camera roll
 */
export async function pickImage(options?: {
  allowsMultiple?: boolean;
  maxImages?: number;
}): Promise<string[] | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: options?.allowsMultiple || false,
    quality: 0.8,
    allowsEditing: !options?.allowsMultiple,
    aspect: [4, 3],
  });

  if (result.canceled) return null;

  return result.assets.map((asset) => asset.uri);
}

/**
 * Compress and resize an image
 */
export async function compressImage(
  uri: string,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
): Promise<string> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.7 } = options || {};

  const manipResult = await manipulateAsync(
    uri,
    [{ resize: { width: maxWidth, height: maxHeight } }],
    {
      compress: quality,
      format: SaveFormat.JPEG,
    }
  );

  return manipResult.uri;
}

/**
 * Convert image URI to base64 string
 */
export async function imageToBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Return with data URI prefix
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image');
  }
}

/**
 * Pick, compress, and convert image to base64 (all-in-one)
 */
export async function pickAndProcessImage(options?: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}): Promise<string | null> {
  const uris = await pickImage({ allowsMultiple: false });
  if (!uris || uris.length === 0) return null;

  const compressedUri = await compressImage(uris[0], options);
  const base64 = await imageToBase64(compressedUri);

  return base64;
}

/**
 * Pick, compress, and convert multiple images to base64
 */
export async function pickAndProcessMultipleImages(options?: {
  maxImages?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}): Promise<string[]> {
  const { maxImages = 5, ...compressOptions } = options || {};

  const uris = await pickImage({ allowsMultiple: true, maxImages });
  if (!uris || uris.length === 0) return [];

  // Limit to maxImages
  const limitedUris = uris.slice(0, maxImages);

  // Process all images in parallel
  const base64Promises = limitedUris.map(async (uri) => {
    const compressedUri = await compressImage(uri, compressOptions);
    return imageToBase64(compressedUri);
  });

  return Promise.all(base64Promises);
}
