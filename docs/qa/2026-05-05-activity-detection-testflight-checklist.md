# TestFlight QA — Activity Detection Rework

**Date:** 2026-05-05
**Branch:** `feat/activity-detection-rework`
**Build:** `<eas build id — fill in after Task 32>`
**Backend:** staging at `<url — fill in>`
**Testers:** Ashkan + beta team

---

## Prerequisites

- Backend additive migrations (items 1, 2, 4, 6, 7 from handoff doc) deployed to staging.
- Backend behaviour changes (items 3, 5, 8, 9, 11) deployed to staging.
- Device: real iPhone (iOS 16+). The simulator cannot fully simulate app suspension / SLC wakes.

---

## 1. Multi-Modal Detection

### 1a. Bike → Train → Bike commute
- [ ] Start a bike ride, then board a train (or sit in a car for 2+ minutes)
- [ ] Continue on bike after transit
- [ ] Result: **2 separate cycling trips** appear — one before transit, one after
- [ ] No "Cycling" trip with ~2 km/h avg speed (the transit segment must not be labelled as cycling)
- [ ] Each trip's start time aligns with when you actually got on/off the bike

### 1b. Walk → Train → Walk
- [ ] Walk to a station, board, walk from destination
- [ ] Result: **2 separate walking trips** — no merged walk-transit-walk record

### 1c. Single-mode control (regression)
- [ ] Complete a pure cycling trip with no transit
- [ ] Result: **1 cycling trip**, stats unchanged from pre-rework behaviour
- [ ] Avg Moving Speed excludes stationary time (traffic lights etc.)

---

## 2. Force-Quit Recovery

### 2a. SLC wake during active ride
- [ ] Start a bike trip, force-quit the app
- [ ] Continue cycling 600 m+
- [ ] Observe: app wakes via Significant Location Change, trip resumes automatically
- [ ] After reopening the app: the in-progress trip is shown, distance accumulated during force-quit is included

### 2b. Missed-start synthesis
- [ ] Force-quit the app, then walk for 4+ minutes without reopening
- [ ] Reopen the app
- [ ] Result: a **synthesized walking trip** appears with pedometer distance (from `CMPedometer`), even though GPS was not running

### 2c. BGTaskScheduler background sync
- [ ] Complete a trip, background the app (don't force-quit)
- [ ] Wait 15–20 minutes without opening the app
- [ ] Check backend: the trip should appear synced without opening the app

---

## 3. Metrics Accuracy

### 3a. Max Speed ceiling
- [ ] Complete a cycling trip
- [ ] Open trip detail → Max Speed field
- [ ] Value must be **≤ 60 km/h** (spike-filtered ceiling for cycling)
- [ ] Complete a walking trip: Max Speed must be **≤ 12 km/h**

### 3b. Avg Moving Speed
- [ ] Complete a cycling trip with stops (traffic lights, pauses)
- [ ] Open trip detail → "Avg Moving Speed"
- [ ] Value must be a plausible cycling speed (not inflated by time stopped), **not** ≈ 2 km/h
- [ ] Compare to distance ÷ moving time — should match within ~10%

### 3c. Elevation
- [ ] Complete a trip on a route with noticeable hills
- [ ] Open trip detail → elevation row
- [ ] Shows "X m gained · Y m lost" using barometric altimeter, not GPS altitude
- [ ] Shows "—" on a flat route or if altimeter unavailable (e.g. iPad without barometer)

### 3d. CO₂
- [ ] Sync a completed cycling trip to the backend
- [ ] Open trip detail → CO₂ row appears with the backend-calculated value
- [ ] Local-only (not-yet-synced) trips show no CO₂ row ("—")

---

## 4. Notes Pipeline

### 4a. Tap-to-edit persists locally
- [ ] Open any completed trip → tap the Notes section
- [ ] Type "great ride", tap Save
- [ ] Background the app, reopen, navigate back to the same trip
- [ ] Notes shows "great ride" — not blank

### 4b. Notes sync to backend
- [ ] After saving a note, check the backend API response for that trip
- [ ] `user_note` field contains "great ride"
- [ ] `validation_log` is separate (not mixed into `user_note`)

### 4c. Offline note, then reconnect
- [ ] Turn on Airplane Mode
- [ ] Edit a note on a synced trip, save
- [ ] Turn off Airplane Mode
- [ ] Within ~30 seconds (next sync cycle): backend reflects the edit
- [ ] Check via API: `user_note` updated

### 4d. Validation messages are NOT in main Notes
- [ ] Open a trip that has a backend validation message (e.g., an old trip that was flagged)
- [ ] Main Notes section shows **only** `user_note` content (or the tap-to-add placeholder)
- [ ] Auto-validation messages appear **only** inside Beta Diagnostics → Validation log

### 4e. Beta Diagnostics drawer
- [ ] Open any trip on a debug/preview build
- [ ] Tap "Beta Diagnostics"
- [ ] Verify all fields visible: Trip ID, Backend ID, GPS Points, Classifier, Validation log, Entry Type, Status

---

## 5. Permissions & Onboarding

### 5a. Permissions explainer shown on fresh install
- [ ] Delete and reinstall the app (or reset permissions via Settings)
- [ ] Onboarding shows the "A couple of permissions" explainer screen
- [ ] Tap "Grant permissions" → iOS prompts for Location (Always) and Motion & Fitness

### 5b. Location downgrade detection
- [ ] After granting Always, go to Settings → Privacy → Location Services → BeActive → change to "While Using"
- [ ] Return to the app
- [ ] A banner on the home screen prompts the user to restore "Always" access

### 5c. Motion & Fitness denial
- [ ] Deny Motion & Fitness permission
- [ ] Complete a trip: app still records GPS; classification falls back gracefully (no crash, no freeze)
- [ ] Trip type may be "walk" by default — acceptable

---

## 6. Classification Source Integrity

- [ ] Complete a trip with Motion & Fitness granted
- [ ] Open Beta Diagnostics → Classifier shows `apple_motion`
- [ ] Backend trip record has `classification_source = 'apple_motion'`
- [ ] Complete a manually-entered trip → Classifier shows `manual`

---

## 7. Regression — Existing Trips

- [ ] Trip history list loads without errors
- [ ] Legacy trips (recorded before this build) display correctly — no blank screens
- [ ] Elevation shows "—" for legacy trips (expected — altimeter data was not collected)
- [ ] Notes on legacy trips preserved (migrated from `notes` → `user_note` or `validation_log`)

---

## Sign-off

| Area | Tester | Date | Result |
|------|--------|------|--------|
| Multi-modal detection | | | |
| Force-quit recovery | | | |
| Metrics accuracy | | | |
| Notes pipeline | | | |
| Permissions / onboarding | | | |
| Classification source | | | |
| Regression — existing trips | | | |

**Go/No-Go decision:** After 1 week soak with all items checked, proceed to Task 33 (production build + App Store submit).
