import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { CheckIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { LANGUAGE_OPTIONS, type LanguageOption } from '@/lib/i18n/types';
import { ThemedText } from '@/components/themed-text';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguagePicker({ visible, onClose }: LanguagePickerProps) {
  const { colors } = useTheme();
  const { currentLanguage, changeLanguage, isChanging } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);

  const handleSelectLanguage = async (language: LanguageOption) => {
    setSelectedLanguage(language.code);
    await changeLanguage(language.code);
    // Close modal after a short delay to show the selection
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const renderLanguageItem = ({ item }: { item: LanguageOption }) => {
    const isSelected = item.code === selectedLanguage;

    return (
      <TouchableOpacity
        style={[
          styles.languageItem,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
        onPress={() => handleSelectLanguage(item)}
        disabled={isChanging}
      >
        <View style={styles.languageInfo}>
          <ThemedText style={styles.languageName}>{item.nativeName}</ThemedText>
          <ThemedText style={[styles.languageSubtitle, { color: colors.textSecondary }]}>
            {item.name}
          </ThemedText>
        </View>

        {isSelected && (
          <View style={[styles.checkmark, { backgroundColor: colors.primary + '15' }]}>
            <CheckIcon size={20} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1} />

        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.headerTitle}>Select Language</ThemedText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XMarkIcon size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Language List */}
          {isChanging ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                Changing language...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.listContainer}>
              <FlatList
                data={LANGUAGE_OPTIONS}
                renderItem={renderLanguageItem}
                keyExtractor={(item) => item.code}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 300,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  languageSubtitle: {
    fontSize: 14,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
