import { useEffect } from 'react';
import { router } from 'expo-router';

export default function QuickActionsScreen() {
  useEffect(() => {
    // Immediately redirect to the modal when this tab is pressed
    router.push('/modals/quick-actions-modal');
  }, []);

  return null;
}
