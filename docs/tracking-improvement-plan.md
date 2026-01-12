# Tracking System Improvement Plan

## Problem Statement
1. **Train rides classified as runs** - Trains at 8-15 km/h appear as running
2. **Background tracking fails** - Tracking stops when phone locked/app closed (iOS & Android)
3. **Wrong start points** - GPS cold-start gives inaccurate initial locations
4. **Inconsistent classification** - Frontend/backend use different thresholds

## Solution Overview
- **Frontend**: Fix background tracking, add GPS stabilization, improve local classification
- **Backend**: Your engineer will implement comprehensive classification (requirements listed below)

---

## PART A: Frontend Implementation (I will code this)

### Phase 1: Fix Background Tracking Failures

**File: `ccapp-frontend/lib/services/LocationTrackingService.ts`**

#### 1.1 Add AppState Listener
- Import `AppState` from react-native
- Add listener for app foreground/background transitions
- On foreground resume: check for zombie trips, verify permissions

#### 1.2 Add Zombie Trip Detection
- When app returns to foreground, check if active trip exists
- If last location is > 15 minutes old, auto-complete the trip
- Add note to trip: "[Auto-ended: background timeout]"

#### 1.3 Add Permission Revocation Handling
- Re-check permissions when app resumes
- If "Always" permission was downgraded to "While Using", warn user
- Handle graceful degradation

**File: `ccapp-frontend/contexts/TrackingContext.tsx`**
- Initialize AppState listener on mount

---

### Phase 2: Fix Wrong Start Points

**File: `ccapp-frontend/lib/services/LocationTrackingService.ts`**

#### 2.1 Add Location Accuracy Filtering
```typescript
const MIN_ACCURACY_METERS = 50;

function isLocationAccurate(location): boolean {
  return (location.coords.accuracy || 0) <= MIN_ACCURACY_METERS;
}
```
- Filter out inaccurate GPS points before processing
- Log filtered points for debugging

#### 2.2 Add GPS Stabilization
- Wait for 3 accurate readings before using location data
- Use best (most accurate) point from stabilization buffer as start point
- Reset stabilization buffer when trip ends

---

### Phase 3: Improve Frontend Classification

**File: `ccapp-frontend/lib/services/ActivityClassifier.ts`**

#### 3.1 Add Speed Distribution Analysis
- Calculate median, p25, p75, variance from recent speeds
- Use median instead of mean (robust to outliers)
- Adjust confidence based on speed consistency

#### 3.2 Add Pattern-Based Detection (Frontend Heuristics)
- Calculate basic sinuosity from recent points
- If sinuosity < 1.15 AND speed 8-15 km/h AND sustained > 70% → flag as "possibly transit"
- Reduce confidence for potential transit misclassifications

---

### Phase 4: Update API to Send More Data

**File: `ccapp-frontend/lib/api/trips.ts`**

#### 4.1 Include Speed Data in Route Points
```typescript
route = locations.map(loc => ({
  lat: loc.latitude,
  lng: loc.longitude,
  timestamp: new Date(loc.timestamp).toISOString(),
  speed: loc.speed,      // NEW: for backend analysis
  accuracy: loc.accuracy, // NEW: for filtering
}));
```

#### 4.2 Send Frontend Classification
```typescript
return {
  ...tripData,
  frontend_type: dbTrip.type, // NEW: what frontend classified
};
```

---

## PART B: Backend Requirements (For Your Engineer)

### Required Backend Changes

#### 1. New Classification Endpoint/Logic

**Create: `api/trips/classification.py`**

The backend should implement a comprehensive classifier that analyzes:

| Metric | How to Calculate | Train Value | Runner Value |
|--------|------------------|-------------|--------------|
| **Sinuosity** | total_path_distance / straight_line_distance | 1.0 - 1.15 | 1.3 - 2.0+ |
| **Bearing changes/km** | Count direction changes > 30° | < 3 | > 5 |
| **Speed variance** | Standard deviation of speeds | Low (< 2) | High (> 3) |
| **Sustained speed ratio** | % of time at 8+ km/h | > 70% | < 50% |
| **IQR** | p75_speed - p25_speed | < 3 km/h | > 5 km/h |

**Classification Rules:**
```
IF sinuosity < 1.15
   AND sustained_high_speed_ratio > 0.7
   AND bearing_changes_per_km < 3
   AND median_speed BETWEEN 8 AND 20 km/h
THEN classify as 'transit' (not 'run')
```

#### 2. New Model Fields

Add to `Trip` model:
- `classification_confidence` (IntegerField, nullable)
- `classification_override` (BooleanField, default=False)
- `classification_metadata` (JSONField, nullable) - store analysis for ML
- `frontend_classification` (CharField, nullable) - what frontend said
- Add `'transit'` to `TRIP_TYPE_CHOICES`

#### 3. Update Serializer

In `TripSerializer.create()`:
- Accept `frontend_type` from request
- Calculate all metrics from route data (which now includes speed per point)
- Apply classification rules
- Store whether backend overrode frontend classification

#### 4. API Response

Return to frontend:
- `type`: final classification (backend's decision)
- `classification_confidence`: 0-100
- `classification_override`: true if backend changed frontend's classification

---

## Testing Plan

### Manual Tests (Both Platforms)

1. **Walk Test**: 10 min normal pace with turns → expect "walk"
2. **Run Test**: 10 min with speed variation → expect "run"
3. **Train Test**: Ride including acceleration/deceleration → expect "transit" (after backend fix)
4. **Background (iOS)**: Lock phone 15 min while tracking → expect continuous data
5. **Background (Android)**: Same + force-stop app → expect zombie detection on reopen
6. **GPS Cold Start**: Start trip immediately → expect accurate first location

---

## Files I Will Modify (Frontend Only)

| File | Changes |
|------|---------|
| [LocationTrackingService.ts](lib/services/LocationTrackingService.ts) | AppState listener, zombie detection, GPS stabilization, accuracy filtering |
| [TrackingContext.tsx](contexts/TrackingContext.tsx) | Initialize AppState listener |
| [ActivityClassifier.ts](lib/services/ActivityClassifier.ts) | Speed distribution, pattern heuristics |
| [trips.ts](lib/api/trips.ts) | Send speed data + frontend_type |

---

## Implementation Order

1. **Background tracking fixes** (AppState, zombie detection, permissions)
2. **GPS stabilization + accuracy filtering**
3. **Frontend classification improvements**
4. **API updates** (send more data to backend)
5. **Testing on both platforms**

Backend work can happen in parallel - frontend changes will work with current backend but will be more accurate once backend classifier is implemented.
