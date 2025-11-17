/**
 * Services Module
 *
 * Export all service classes and utilities
 */

export { LocationTrackingService } from './LocationTrackingService';
export type { TrackingConfig } from './LocationTrackingService';

export { ActivityClassifier } from './ActivityClassifier';
export type { ActivityType, ActivityClassification, ActivityThresholds } from './ActivityClassifier';

export { TripDetectionService } from './TripDetectionService';
export type { DetectionConfig } from './TripDetectionService';

export { TripManager } from './TripManager';
