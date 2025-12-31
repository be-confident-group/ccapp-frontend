/**
 * Image utility functions for handling image uploads
 */

import * as ImagePicker from 'expo-image-picker';
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
}): Promise<ImagePicker.ImagePickerAsset[] | null> {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options?.allowsMultiple || false,
    quality: 0.8,
    allowsEditing: !options?.allowsMultiple,
    aspect: [4, 3],
    base64: true, // Get base64 data directly from ImagePicker
  });

  if (result.canceled) return null;

  return result.assets;
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
 * Convert ImagePicker asset to base64 data URI
 */
export function assetToBase64(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.base64) {
    // Determine mime type from uri
    const extension = asset.uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${asset.base64}`;
  }

  throw new Error('No base64 data available from image picker');
}

/**
 * Pick, compress, and convert image to base64 (all-in-one)
 */
export async function pickAndProcessImage(options?: {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}): Promise<string | null> {
  const assets = await pickImage({ allowsMultiple: false });
  if (!assets || assets.length === 0) return null;

  // Use the base64 from picker directly (already compressed by quality: 0.8)
  return assetToBase64(assets[0]);
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
  const { maxImages = 5 } = options || {};

  const assets = await pickImage({ allowsMultiple: true, maxImages });
  if (!assets || assets.length === 0) return [];

  // Limit to maxImages
  const limitedAssets = assets.slice(0, maxImages);

  // Convert all to base64 (ImagePicker already provides base64)
  return limitedAssets.map(assetToBase64);
}
