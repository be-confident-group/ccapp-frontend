import React from 'react';
import { Linking, Text, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/config/env';

interface TermsPrivacyNoticeProps {
  style?: TextStyle | TextStyle[];
}

export function TermsPrivacyNotice({ style }: TermsPrivacyNoticeProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Text style={style}>
      {t('auth:welcome.termsPrefix')}
      <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
        {t('auth:welcome.terms')}
      </Text>
      {t('auth:welcome.and')}
      <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
        {t('auth:welcome.privacy')}
      </Text>
    </Text>
  );
}
