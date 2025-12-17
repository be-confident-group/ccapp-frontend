/**
 * Hook for managing trophy unlock modal
 */

import { useState, useCallback } from 'react';
import type { Trophy } from '@/lib/api/trophies';

export function useTrophyUnlock() {
  const [trophyQueue, setTrophyQueue] = useState<Trophy[]>([]);
  const [currentTrophy, setCurrentTrophy] = useState<Trophy | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  /**
   * Show trophy unlock modal(s) for newly earned trophies
   */
  const showTrophyUnlock = useCallback((trophies: Trophy | Trophy[]) => {
    const trophyArray = Array.isArray(trophies) ? trophies : [trophies];

    if (trophyArray.length === 0) return;

    setTrophyQueue(trophyArray);
    setCurrentTrophy(trophyArray[0]);
    setIsModalVisible(true);
  }, []);

  /**
   * Move to next trophy in queue or close modal
   */
  const handleClose = useCallback(() => {
    const remaining = trophyQueue.slice(1);

    if (remaining.length > 0) {
      // Show next trophy
      setTrophyQueue(remaining);
      setCurrentTrophy(remaining[0]);
    } else {
      // No more trophies, close modal
      setIsModalVisible(false);
      setCurrentTrophy(null);
      setTrophyQueue([]);
    }
  }, [trophyQueue]);

  return {
    isModalVisible,
    currentTrophy,
    remainingCount: trophyQueue.length - 1,
    showTrophyUnlock,
    handleClose,
  };
}
