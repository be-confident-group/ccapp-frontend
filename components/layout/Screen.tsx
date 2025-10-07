import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ThemedView } from '@/components/themed-view';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  safe?: boolean;
  keyboardAware?: boolean;
  contentContainerStyle?: ViewStyle;
  noPadding?: boolean;
}

export default function Screen({
  children,
  style,
  scrollable = false,
  safe = true,
  keyboardAware = false,
  contentContainerStyle,
  noPadding = false,
}: ScreenProps) {
  const containerStyle = [
    styles.container,
    !noPadding && styles.padding,
    style,
  ];

  const content = scrollable ? (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        !noPadding && styles.scrollPadding,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={containerStyle}>{children}</View>
  );

  if (keyboardAware) {
    return (
      <ThemedView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {safe ? (
            <SafeAreaView style={styles.flex}>{content}</SafeAreaView>
          ) : (
            content
          )}
        </KeyboardAvoidingView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      {safe ? (
        <SafeAreaView style={styles.flex}>{content}</SafeAreaView>
      ) : (
        content
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  padding: {
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollPadding: {
    padding: 20,
  },
});
