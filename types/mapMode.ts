/**
 * Map mode types for view switching
 */

/**
 * Main map view mode
 */
export type MapViewMode = 'heatmap' | 'feedback';

/**
 * Heatmap sub-mode
 */
export type HeatmapMode = 'global' | 'personal';

/**
 * Feedback sub-mode
 */
export type FeedbackMode = 'community' | 'personal';

/**
 * Complete map mode state
 */
export interface MapModeState {
  viewMode: MapViewMode;
  heatmapMode: HeatmapMode;
  feedbackMode: FeedbackMode;
}

/**
 * Map mode labels for UI
 */
export const MAP_MODE_LABELS = {
  viewMode: {
    heatmap: 'Heatmap',
    feedback: 'Feedback',
  },
  heatmapMode: {
    global: 'Global',
    personal: 'My Heatmap',
  },
  feedbackMode: {
    community: 'Community',
    personal: 'My Feedback',
  },
} as const;
