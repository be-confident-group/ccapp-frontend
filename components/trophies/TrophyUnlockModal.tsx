/**
 * Trophy Unlock Modal
 *
 * Displays an animated celebration modal when user earns a new trophy
 */

import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';
import type { Trophy } from '@/lib/api/trophies';
import { trophyAPI } from '@/lib/api/trophies';

const { width, height } = Dimensions.get('window');

interface TrophyUnlockModalProps {
  visible: boolean;
  trophy: Trophy | null;
  onClose: () => void;
}

export function TrophyUnlockModal({ visible, trophy, onClose }: TrophyUnlockModalProps) {
  const { colors } = useTheme();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible && trophy) {
      // Reset animations
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
      pulseAnim.setValue(1);
      confettiAnims.forEach(anim => {
        anim.translateY.setValue(0);
        anim.translateX.setValue(0);
        anim.rotate.setValue(0);
        anim.opacity.setValue(1);
      });

      // Start entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start confetti animation
      confettiAnims.forEach((anim, index) => {
        const randomX = (Math.random() - 0.5) * width * 0.8;
        const randomRotate = Math.random() * 720 - 360;

        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: height * 0.8,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: randomX,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotate, {
            toValue: randomRotate,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible, trophy]);

  if (!trophy) return null;

  const handleClose = () => {
    // Animate out
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.8)' }]}>
        {/* Confetti */}
        {confettiAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.confetti,
              {
                backgroundColor: ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#32CD32'][index % 5],
                left: (width / 2) + (Math.random() - 0.5) * 100,
                top: height * 0.2,
                transform: [
                  { translateY: anim.translateY },
                  { translateX: anim.translateX },
                  { rotate: anim.rotate.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }) },
                ],
                opacity: anim.opacity,
              },
            ]}
          />
        ))}

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.content,
            {
              backgroundColor: colors.card,
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Trophy Icon */}
          <Animated.View
            style={[
              styles.trophyContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <ThemedText style={styles.trophyEmoji}>
              {trophyAPI.getTrophyIcon(trophy)}
            </ThemedText>
          </Animated.View>

          {/* Title */}
          <ThemedText style={styles.congratsText}>
            Congratulations!
          </ThemedText>

          {/* Trophy Name */}
          <ThemedText style={styles.trophyName}>
            {trophy.name}
          </ThemedText>

          {/* Description */}
          <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
            {trophy.description}
          </ThemedText>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.buttonText}>Continue</ThemedText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  trophyContainer: {
    marginBottom: Spacing.lg,
  },
  trophyEmoji: {
    fontSize: 80,
  },
  congratsText: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  trophyName: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  button: {
    paddingHorizontal: Spacing.xl * 2,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});
