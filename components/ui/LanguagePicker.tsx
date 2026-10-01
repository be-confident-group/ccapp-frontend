import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { LANGUAGE_OPTIONS, type LanguageOption } from '@/lib/i18n/types';
import { ThemedText } from '@/components/themed-text';
import { GlassSheet } from '@/components/ui/GlassSheet';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, isChanging } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const handleClose = () => {
    onClose();
  };

  const handleSelectLanguage = async (language: LanguageOption) => {
    setSelectedLanguage(language.code);
    await changeLanguage(language.code);
    // Close modal after a short delay to show the selection
    setTimeout(() => {
      handleClose();
    }, 300);
  };

  return (
    <GlassSheet
      visible={visible}
      onClose={handleClose}
      title={t('profile:language.selectTitle', { defaultValue: 'Select Language' })}
    >
      {isChanging ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('profile:language.changing', { defaultValue: 'Changing language...' })}
          </ThemedText>
        </View>
      ) : (
        LANGUAGE_OPTIONS.map((item, index) => {
          const isSelected = item.code === selectedLanguage;
          return (
            <Pressable
              key={item.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => handleSelectLanguage(item)}
              disabled={isChanging}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.glassHighlight },
                index < LANGUAGE_OPTIONS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.glassBorder,
                },
              ]}
            >
              <View style={styles.info}>
                <ThemedText style={styles.name}>{item.nativeName}</ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {item.name}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.radio,
                  isSelected
                    ? { backgroundColor: colors.glassActiveFill, borderColor: colors.glassActiveFill }
                    : { borderColor: colors.textSecondary },
                ]}
              >
                {isSelected ? <CheckIcon size={14} color="#FFFFFF" /> : null}
              </View>
            </Pressable>
          );
        })
      )}
    </GlassSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 14,
    minHeight: 56,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
});
