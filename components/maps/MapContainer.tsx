/**
 * Full-screen map container with overlay support
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

interface MapContainerProps {
  children: React.ReactNode;
}

/**
 * Container for full-screen map view
 * Handles safe areas and provides absolute positioning for overlays
 */
export function MapContainer({ children }: MapContainerProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
