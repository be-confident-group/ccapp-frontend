import { Alert, AlertButton } from 'react-native';
import i18n from '@/lib/i18n';

/**
 * Show an alert with translated title and message
 */
export function showAlert(
  titleKey: string,
  messageKey: string,
  buttons?: AlertButton[],
  options?: { cancelable?: boolean }
) {
  const title = i18n.t(titleKey);
  const message = i18n.t(messageKey);

  Alert.alert(title, message, buttons, options);
}

/**
 * Show a confirmation alert with translated strings
 */
export function showConfirmAlert(
  titleKey: string,
  messageKey: string,
  onConfirm: () => void,
  confirmButtonKey: string = 'common:buttons.confirm',
  cancelButtonKey: string = 'common:buttons.cancel',
  confirmStyle: 'default' | 'cancel' | 'destructive' = 'default'
) {
  const title = i18n.t(titleKey);
  const message = i18n.t(messageKey);
  const confirmText = i18n.t(confirmButtonKey);
  const cancelText = i18n.t(cancelButtonKey);

  Alert.alert(
    title,
    message,
    [
      {
        text: cancelText,
        style: 'cancel',
      },
      {
        text: confirmText,
        style: confirmStyle,
        onPress: onConfirm,
      },
    ],
    { cancelable: true }
  );
}

/**
 * Show a simple info alert
 */
export function showInfoAlert(titleKey: string, messageKey: string) {
  const title = i18n.t(titleKey);
  const message = i18n.t(messageKey);

  Alert.alert(title, message);
}

/**
 * Show a coming soon alert
 */
export function showComingSoonAlert(featureKey?: string) {
  const title = i18n.t('alerts:comingSoon.title');
  const message = featureKey
    ? i18n.t(`alerts:comingSoon.${featureKey}`)
    : i18n.t('alerts:error.generic');

  Alert.alert(title, message);
}

/**
 * Show an error alert
 */
export function showErrorAlert(errorKey: string = 'generic') {
  const title = i18n.t('alerts:error.title');
  const message = i18n.t(`alerts:error.${errorKey}`);

  Alert.alert(title, message);
}
