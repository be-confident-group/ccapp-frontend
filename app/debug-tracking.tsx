/**
 * Debug Tracking Screen — tabbed ML debug view
 * Tab 1 Live: sensor buffer + ML classifier state (polls every 1.5 s)
 * Tab 2 Trip: active trip + GPS (polls every 3 s)
 * Tab 3 History: recent activity windows + recent trips (lazy)
 * Tab 4 Logs: live console log viewer
 */

import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { LocationTrackingService } from '@/lib/services/LocationTrackingService';
import { TripDetectionService } from '@/lib/services/TripDetectionService';
import { ActivityClassifier } from '@/lib/services/ActivityClassifier';
import { database, type ActivityWindow } from '@/lib/database';
import { useTheme } from '@/contexts/ThemeContext';
import { onTrackingLog, getTrackingLogBuffer, clearTrackingLogBuffer, type LogEntry } from '@/lib/services/TrackingLogger';
import { sensorBuffer } from '@/lib/activity/sensorBuffer';
import { streamingSegmenter } from '@/lib/activity/streamingSegmenter';
import type { ActivityClass } from '@/lib/activity/classifier';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'live' | 'trip' | 'history' | 'logs';

interface TripData {
  isTracking: boolean;
  taskRegistered: boolean;
  permissions: { foreground: string; background: string };
  activeTrip: {
    id: string;
    startTime: string;
    duration: string;
    distance: number;
    type: string;
    classMethod: string;
    locationsCount: number;
    windowsCount: number;
  } | null;
  lastDbLoc: {
    lat: number; lng: number; accuracy: number | null; speed: number | null;
    time: string; actType: string | null; actConf: number | null;
  } | null;
  currentGps: {
    lat: number; lng: number; accuracy: number | null;
    speedKmh: number; rawSpeed: number | null; wouldStart: boolean;
  } | null;
}

interface HistoryData {
  windows: ActivityWindow[];
  trips: Array<{
    id: string; type: string; status: string; distance: number;
    duration: number; classMethod: string; startTime: string;
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LABEL_COLORS: Record<ActivityClass, string> = {
  walking: '#22C55E',
  cycling: '#3B82F6',
  running: '#F97316',
  vehicle: '#EF4444',
};

function pct(v: number) { return `${(v * 100).toFixed(0)}%`; }
function fix3(v: number) { return v.toFixed(3); }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Card({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.cardTitle, { color: colors.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, valueColor, colors }: { label: string; value: string; valueColor?: string; colors: any }) {
  return (
    <View style={s.row}>
      <Text style={[s.rowLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[s.rowValue, { color: valueColor ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function StatusDot({ on, warn }: { on: boolean; warn?: boolean }) {
  return <View style={[s.dot, { backgroundColor: warn ? '#F59E0B' : on ? '#22C55E' : '#EF4444' }]} />;
}

function ConfBar({ label, prob, colors }: { label: ActivityClass; prob: number; colors: any }) {
  return (
    <View style={s.confRow}>
      <Text style={[s.confLabel, { color: LABEL_COLORS[label] }]}>{label.slice(0, 4)}</Text>
      <View style={[s.confTrack, { backgroundColor: colors.border }]}>
        <View style={[s.confFill, { width: `${Math.round(prob * 100)}%` as any, backgroundColor: LABEL_COLORS[label] }]} />
      </View>
      <Text style={[s.confPct, { color: colors.textSecondary }]}>{pct(prob)}</Text>
    </View>
  );
}

// ─── Tab 1: Live ─────────────────────────────────────────────────────────────

function LiveTab({ liveState, colors }: {
  liveState: {
    sensor: ReturnType<typeof sensorBuffer.getDebugState> | null;
    segmenter: ReturnType<typeof streamingSegmenter.getDebugState> | null;
  };
  colors: any;
}) {
  const { sensor, segmenter } = liveState;

  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent}>

      <Card title="SENSOR BUFFER" colors={colors}>
        <View style={s.statusRow}>
          <StatusDot on={sensor?.running ?? false} />
          <Text style={[s.statusText, { color: colors.text }]}>
            {sensor?.running ? 'Running' : 'Stopped'} · app={sensor?.appState ?? '?'}
          </Text>
        </View>
        <Row label="Samples seen" value={String(sensor?.samplesSeen ?? 0)} colors={colors} />
        <Row label="Buffer fill" value={`${sensor?.bufferFillPct ?? 0}%`} colors={colors} />
        <Row label="Next window in" value={`${sensor?.nextWindowInSamples ?? 128} samples`} colors={colors} />
        <Row label="Attached trip" value={sensor?.tripId ? sensor.tripId.slice(0, 20) + '…' : 'none'} colors={colors} />
        {sensor?.lastAccel && (
          <Row
            label="Accel (x/y/z)"
            value={`${fix3(sensor.lastAccel.x)} / ${fix3(sensor.lastAccel.y)} / ${fix3(sensor.lastAccel.z)}`}
            colors={colors}
          />
        )}
        {sensor?.lastGyro && (
          <Row
            label="Gyro  (x/y/z)"
            value={`${fix3(sensor.lastGyro.x)} / ${fix3(sensor.lastGyro.y)} / ${fix3(sensor.lastGyro.z)}`}
            colors={colors}
          />
        )}
      </Card>

      <Card title="LAST ML PREDICTION" colors={colors}>
        {sensor?.lastPrediction ? (
          <>
            <View style={[s.bigLabelRow, { borderColor: LABEL_COLORS[sensor.lastPrediction.label] }]}>
              <Text style={[s.bigLabel, { color: LABEL_COLORS[sensor.lastPrediction.label] }]}>
                {sensor.lastPrediction.label.toUpperCase()}
              </Text>
              <Text style={[s.bigConf, { color: colors.textSecondary }]}>
                {pct(sensor.lastPrediction.confidence)}
              </Text>
            </View>
            {(['walking', 'cycling', 'running', 'vehicle'] as ActivityClass[]).map((lbl, i) => (
              <ConfBar key={lbl} label={lbl} prob={sensor.lastPrediction!.probs[i]} colors={colors} />
            ))}
            <Row
              label="Window"
              value={`${new Date(sensor.lastPrediction.windowStart).toLocaleTimeString()} → ${new Date(sensor.lastPrediction.windowEnd).toLocaleTimeString()}`}
              colors={colors}
            />
          </>
        ) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No prediction yet — sensor buffer needs 256 samples</Text>
        )}
      </Card>

      <Card title="STREAMING SEGMENTER" colors={colors}>
        <Row
          label="Confirmed label"
          value={segmenter?.current?.label ?? 'none'}
          valueColor={segmenter?.current ? LABEL_COLORS[segmenter.current.label] : undefined}
          colors={colors}
        />
        {segmenter?.current && (
          <Row label="Confirmed conf." value={pct(segmenter.current.confidence)} colors={colors} />
        )}
        <Row
          label="Pending label"
          value={segmenter?.pendingLabel ?? 'none'}
          valueColor={segmenter?.pendingLabel ? LABEL_COLORS[segmenter.pendingLabel] : undefined}
          colors={colors}
        />
        <Row
          label="Pending count"
          value={`${segmenter?.pendingCount ?? 0} / ${segmenter?.confirmWindowsNeeded ?? 2}`}
          colors={colors}
        />
        <Row
          label="Segmenter trip"
          value={segmenter?.tripId ? segmenter.tripId.slice(0, 20) + '…' : 'none'}
          colors={colors}
        />
      </Card>

    </ScrollView>
  );
}

// ─── Tab 2: Trip ─────────────────────────────────────────────────────────────

function TripTab({
  tripData, colors, gpsTestResult, testingGps,
  onForceStart, onForceStop, onGpsTest, refreshing, onRefresh,
}: {
  tripData: TripData | null; colors: any; gpsTestResult: string | null; testingGps: boolean;
  onForceStart: () => void; onForceStop: () => void; onGpsTest: () => void;
  refreshing: boolean; onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card title="TRACKING STATUS" colors={colors}>
        <View style={s.statusRow}>
          <StatusDot on={tripData?.isTracking ?? false} />
          <Text style={[s.statusText, { color: colors.text }]}>
            {tripData?.isTracking ? 'Tracking active' : 'Not tracking'}
          </Text>
        </View>
        <Row
          label="BG task registered"
          value={tripData?.taskRegistered ? 'YES' : 'NO'}
          valueColor={tripData?.taskRegistered ? '#22C55E' : '#EF4444'}
          colors={colors}
        />
        <Row label="Foreground perm." value={tripData?.permissions.foreground ?? '?'} colors={colors} />
        <Row label="Background perm." value={tripData?.permissions.background ?? '?'} colors={colors} />
      </Card>

      {tripData?.activeTrip ? (
        <Card title="ACTIVE TRIP" colors={colors}>
          <Row label="ID" value={tripData.activeTrip.id} colors={colors} />
          <Row label="Type" value={tripData.activeTrip.type} colors={colors} />
          <Row
            label="Method"
            value={tripData.activeTrip.classMethod}
            valueColor={tripData.activeTrip.classMethod === 'ml' ? '#22C55E' : '#F59E0B'}
            colors={colors}
          />
          <Row label="Started" value={tripData.activeTrip.startTime} colors={colors} />
          <Row label="Duration" value={tripData.activeTrip.duration} colors={colors} />
          <Row label="Distance" value={`${(tripData.activeTrip.distance / 1000).toFixed(2)} km`} colors={colors} />
          <Row label="GPS points" value={String(tripData.activeTrip.locationsCount)} colors={colors} />
          <Row label="ML windows" value={String(tripData.activeTrip.windowsCount)} colors={colors} />
        </Card>
      ) : (
        <Card title="ACTIVE TRIP" colors={colors}>
          <Text style={[s.empty, { color: colors.textSecondary }]}>No active trip</Text>
        </Card>
      )}

      {tripData?.lastDbLoc && (
        <Card title="LAST DB LOCATION" colors={colors}>
          <Row
            label="Lat / Lng"
            value={`${tripData.lastDbLoc.lat.toFixed(6)}, ${tripData.lastDbLoc.lng.toFixed(6)}`}
            colors={colors}
          />
          <Row
            label="Accuracy"
            value={`${tripData.lastDbLoc.accuracy?.toFixed(0) ?? '?'} m`}
            colors={colors}
          />
          <Row
            label="Speed"
            value={tripData.lastDbLoc.speed != null
              ? `${(tripData.lastDbLoc.speed * 3.6).toFixed(1)} km/h`
              : 'unavail.'}
            colors={colors}
          />
          <Row label="Time" value={tripData.lastDbLoc.time} colors={colors} />
          {tripData.lastDbLoc.actType && (
            <Row
              label="Activity"
              value={`${tripData.lastDbLoc.actType} (${pct(tripData.lastDbLoc.actConf ?? 0)})`}
              valueColor={LABEL_COLORS[tripData.lastDbLoc.actType as ActivityClass] ?? colors.text}
              colors={colors}
            />
          )}
        </Card>
      )}

      {tripData?.currentGps && (
        <Card title="CURRENT GPS" colors={colors}>
          <Row
            label="Lat / Lng"
            value={`${tripData.currentGps.lat.toFixed(6)}, ${tripData.currentGps.lng.toFixed(6)}`}
            colors={colors}
          />
          <Row
            label="Accuracy"
            value={`${tripData.currentGps.accuracy?.toFixed(0) ?? '?'} m`}
            colors={colors}
          />
          <Row
            label="Speed"
            value={tripData.currentGps.rawSpeed != null && tripData.currentGps.rawSpeed < 0
              ? 'unavail. (iOS)'
              : `${tripData.currentGps.speedKmh.toFixed(1)} km/h`}
            colors={colors}
          />
          <Row
            label="Would start trip"
            value={tripData.currentGps.wouldStart ? 'YES ✓' : 'NO ✗'}
            valueColor={tripData.currentGps.wouldStart ? '#22C55E' : '#EF4444'}
            colors={colors}
          />
        </Card>
      )}

      {gpsTestResult && (
        <Card title="GPS TEST RESULT" colors={colors}>
          <Text style={[s.mono, { color: colors.text }]}>{gpsTestResult}</Text>
        </Card>
      )}

      <View style={s.actions}>
        <Pressable style={[s.btn, { backgroundColor: '#22C55E' }]} onPress={onForceStart}>
          <Text style={s.btnText}>Force Start Trip</Text>
        </Pressable>
        <Pressable style={[s.btn, { backgroundColor: '#EF4444' }]} onPress={onForceStop}>
          <Text style={s.btnText}>Force Stop Trip</Text>
        </Pressable>
        <Pressable style={[s.btn, { backgroundColor: colors.primary }]} onPress={onGpsTest} disabled={testingGps}>
          <Text style={s.btnText}>{testingGps ? 'Testing…' : 'GPS Test'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Tab 3: History ───────────────────────────────────────────────────────────

function HistoryTab({ historyData, colors, onRefresh }: {
  historyData: HistoryData | null; colors: any; onRefresh: () => void;
}) {
  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent}>
      <Pressable style={[s.btn, { backgroundColor: colors.primary, marginBottom: 4 }]} onPress={onRefresh}>
        <Text style={s.btnText}>Refresh</Text>
      </Pressable>

      <Card title="RECENT ACTIVITY WINDOWS (last 30)" colors={colors}>
        {historyData?.windows.length ? historyData.windows.map((w, i) => (
          <View key={w.id ?? i} style={[s.windowRow, { borderBottomColor: colors.border }]}>
            <Text style={[s.windowLabel, { color: LABEL_COLORS[w.label as ActivityClass] ?? colors.text }]}>
              {w.label}
            </Text>
            <Text style={[s.windowConf, { color: colors.textSecondary }]}>{pct(w.confidence)}</Text>
            <Text style={[s.windowTime, { color: colors.textSecondary }]}>
              {new Date(w.t_start).toLocaleTimeString()}
            </Text>
          </View>
        )) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No windows recorded yet</Text>
        )}
      </Card>

      <Card title="RECENT TRIPS (last 5)" colors={colors}>
        {historyData?.trips.length ? historyData.trips.map((t, i) => (
          <View key={i} style={[s.tripRow, { borderBottomColor: colors.border }]}>
            <View style={s.tripRowLeft}>
              <Text style={[s.tripType, { color: colors.text }]}>{t.type} · {t.status}</Text>
              <Text style={[s.tripMeta, { color: colors.textSecondary }]}>{t.startTime}</Text>
            </View>
            <View style={s.tripRowRight}>
              <Text style={[s.tripDist, { color: colors.text }]}>{(t.distance / 1000).toFixed(2)} km</Text>
              <Text style={[s.tripMethod, { color: t.classMethod === 'ml' ? '#22C55E' : '#F59E0B' }]}>
                {t.classMethod}
              </Text>
            </View>
          </View>
        )) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No trips yet</Text>
        )}
      </Card>
    </ScrollView>
  );
}

// ─── Tab 4: Logs ─────────────────────────────────────────────────────────────

function LogsTab({ logs, filter, onFilterChange, scrollRef, colors }: {
  logs: LogEntry[];
  filter: 'all' | 'info' | 'warn' | 'error';
  onFilterChange: (f: 'all' | 'info' | 'warn' | 'error') => void;
  scrollRef: React.RefObject<ScrollView | null>;
  colors: any;
}) {
  const filtered = filter === 'all' ? logs : logs.filter(l => l.level === filter);

  function logColor(level: LogEntry['level']): string {
    if (level === 'error') return '#EF4444';
    if (level === 'warn') return '#F59E0B';
    return colors.text;
  }

  function fmtTime(ts: number): string {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[s.logToolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['all', 'info', 'warn', 'error'] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => onFilterChange(f)}
            style={[s.filterBtn, filter === f && { backgroundColor: colors.primary }]}
          >
            <Text style={[s.filterText, { color: filter === f ? '#fff' : colors.textSecondary }]}>{f}</Text>
          </Pressable>
        ))}
        <Pressable style={[s.filterBtn, { backgroundColor: '#6B7280' }]} onPress={() => clearTrackingLogBuffer()}>
          <Text style={[s.filterText, { color: '#fff' }]}>clear</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scrollRef}
        style={[s.logScroll, { backgroundColor: colors.background }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {filtered.map((entry, i) => (
          <Text key={i} style={[s.logLine, { color: logColor(entry.level) }]}>
            {fmtTime(entry.timestamp)} {entry.message}
          </Text>
        ))}
        {filtered.length === 0 && (
          <Text style={[s.empty, { color: colors.textSecondary, padding: 8 }]}>No logs</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DebugTrackingScreen() {
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('live');

  // ── Tab 1: Live — polls every 1.5 s regardless of active tab ──
  const [liveState, setLiveState] = useState<{
    sensor: ReturnType<typeof sensorBuffer.getDebugState> | null;
    segmenter: ReturnType<typeof streamingSegmenter.getDebugState> | null;
  }>({ sensor: null, segmenter: null });

  useEffect(() => {
    const poll = () => setLiveState({
      sensor: sensorBuffer.getDebugState(),
      segmenter: streamingSegmenter.getDebugState(),
    });
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, []);

  // ── Tab 2: Trip — polls every 3 s when tab is active ──
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [tripRefreshing, setTripRefreshing] = useState(false);
  const [gpsTestResult, setGpsTestResult] = useState<string | null>(null);
  const [testingGps, setTestingGps] = useState(false);

  const loadTripData = async () => {
    try {
      const [isTracking, taskRegistered, permissions, activeTrip] = await Promise.all([
        LocationTrackingService.isTracking(),
        TaskManager.isTaskRegisteredAsync('background-location-task'),
        LocationTrackingService.checkPermissions(),
        database.getActiveTrip(),
      ]);

      let activeTripInfo: TripData['activeTrip'] = null;
      let lastDbLoc: TripData['lastDbLoc'] = null;

      if (activeTrip) {
        const [locs, windows] = await Promise.all([
          database.getLocationsByTrip(activeTrip.id),
          database.getActivityWindowsByTrip(activeTrip.id),
        ]);
        const elapsed = Date.now() - activeTrip.start_time;
        activeTripInfo = {
          id: activeTrip.id.slice(0, 20) + '…',
          startTime: new Date(activeTrip.start_time).toLocaleTimeString(),
          duration: `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`,
          distance: activeTrip.distance || 0,
          type: activeTrip.type || '?',
          classMethod: activeTrip.classification_method || 'speed',
          locationsCount: locs.length,
          windowsCount: windows.length,
        };
        if (locs.length > 0) {
          const last = locs[locs.length - 1];
          lastDbLoc = {
            lat: last.latitude, lng: last.longitude, accuracy: last.accuracy,
            speed: last.speed, time: new Date(last.timestamp).toLocaleTimeString(),
            actType: last.activity_type ?? null, actConf: last.activity_confidence ?? null,
          };
        }
      } else {
        // Fall back to last saved location from any recent trip
        const all = await database.getAllTrips();
        for (const t of all.slice(-3).reverse()) {
          const locs = await database.getLocationsByTrip(t.id);
          if (locs.length > 0) {
            const last = locs[locs.length - 1];
            lastDbLoc = {
              lat: last.latitude, lng: last.longitude, accuracy: last.accuracy,
              speed: last.speed, time: new Date(last.timestamp).toLocaleTimeString(),
              actType: last.activity_type ?? null, actConf: last.activity_confidence ?? null,
            };
            break;
          }
        }
      }

      let currentGps: TripData['currentGps'] = null;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const raw = loc.coords.speed;
        const speed = raw != null && raw >= 0 ? raw : 0;
        currentGps = {
          lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy,
          speedKmh: speed * 3.6, rawSpeed: raw,
          wouldStart: TripDetectionService.shouldStartTrip(speed),
        };
      } catch { /* GPS unavailable */ }

      setTripData({ isTracking, taskRegistered, permissions, activeTrip: activeTripInfo, lastDbLoc, currentGps });
    } catch (err) {
      console.error('[DebugTracking] Trip tab error:', err);
    }
  };

  useEffect(() => {
    if (tab !== 'trip') return;
    loadTripData();
    const id = setInterval(loadTripData, 3000);
    return () => clearInterval(id);
  }, [tab]);

  const handleTripRefresh = async () => {
    setTripRefreshing(true);
    await loadTripData();
    setTripRefreshing(false);
  };

  // ── Tab 3: History — lazy loads on tab switch ──
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);

  const loadHistory = async () => {
    try {
      const [windows, allTrips] = await Promise.all([
        database.getRecentActivityWindows(30),
        database.getAllTrips(),
      ]);
      setHistoryData({
        windows,
        trips: allTrips.slice(-5).reverse().map(t => ({
          id: t.id.slice(0, 16) + '…',
          type: t.type || '?',
          status: t.status,
          distance: t.distance || 0,
          duration: t.duration || 0,
          classMethod: t.classification_method || 'speed',
          startTime: new Date(t.start_time).toLocaleTimeString(),
        })),
      });
    } catch (err) {
      console.error('[DebugTracking] History tab error:', err);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  // ── Tab 4: Logs — live subscription ──
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setConsoleLogs(getTrackingLogBuffer());
    return onTrackingLog(entry => setConsoleLogs(prev => [...prev.slice(-199), entry]));
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const forceStartTrip = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const raw = loc.coords.speed;
      const speed = raw != null && raw >= 0 ? raw : 0;
      const classification = ActivityClassifier.classifyBySpeed(speed);
      const typeMap: Record<string, 'walk' | 'run' | 'cycle' | 'drive'> = {
        walking: 'walk', running: 'run', cycling: 'cycle', driving: 'drive', stationary: 'walk',
      };
      const tripId = `debug_trip_${Date.now()}`;
      await database.createTrip({
        id: tripId, user_id: 'debug_user', status: 'active',
        type: typeMap[classification.type] ?? 'walk',
        start_time: Date.now(), created_at: Date.now(), updated_at: Date.now(),
      });
      await database.addLocation({
        trip_id: tripId, latitude: loc.coords.latitude, longitude: loc.coords.longitude,
        altitude: loc.coords.altitude, accuracy: loc.coords.accuracy, speed,
        heading: loc.coords.heading, timestamp: loc.timestamp,
        activity_type: classification.type, activity_confidence: classification.confidence, synced: 0,
      });
      Alert.alert('Trip Started', `ID: ${tripId.slice(0, 25)}…\nType: ${typeMap[classification.type] ?? 'walk'}`);
      loadTripData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown');
    }
  };

  const forceStopTrip = async () => {
    try {
      const active = await database.getActiveTrip();
      if (!active) { Alert.alert('No active trip'); return; }
      await database.updateTrip(active.id, { status: 'completed', end_time: Date.now(), updated_at: Date.now() });
      Alert.alert('Trip Stopped', active.id.slice(0, 25) + '…');
      loadTripData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown');
    }
  };

  const testGps = async () => {
    setTestingGps(true);
    setGpsTestResult(null);
    try {
      const t0 = Date.now();
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const elapsed = Date.now() - t0;
      const raw = loc.coords.speed;
      const speed = raw != null && raw >= 0 ? raw : 0;
      const config = TripDetectionService.getConfig();
      const wouldStart = TripDetectionService.shouldStartTrip(speed);
      setGpsTestResult([
        `Responded in ${elapsed} ms`,
        `Coords: ${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`,
        `Accuracy: ${loc.coords.accuracy?.toFixed(0) ?? '?'} m`,
        raw != null && raw < 0
          ? `Speed: unavailable (iOS returned ${raw})`
          : `Speed: ${(speed * 3.6).toFixed(1)} km/h (need >${(config.movementSpeedThreshold * 3.6).toFixed(1)})`,
        `Would start trip: ${wouldStart ? 'YES ✓' : 'NO ✗'}`,
      ].join('\n'));
    } catch (err) {
      setGpsTestResult(`GPS Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setTestingGps(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'trip', label: 'Trip' },
    { key: 'history', label: 'History' },
    { key: 'logs', label: 'Logs' },
  ];

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Text style={[s.backText, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[s.title, { color: colors.text }]}>Debug</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map(t => (
          <Pressable key={t.key} style={s.tabItem} onPress={() => setTab(t.key)}>
            <Text style={[s.tabLabel, { color: tab === t.key ? colors.primary : colors.textSecondary }]}>
              {t.label}
            </Text>
            {tab === t.key && <View style={[s.tabUnderline, { backgroundColor: colors.primary }]} />}
          </Pressable>
        ))}
      </View>

      {/* Tab content */}
      {tab === 'live' && <LiveTab liveState={liveState} colors={colors} />}
      {tab === 'trip' && (
        <TripTab
          tripData={tripData} colors={colors}
          gpsTestResult={gpsTestResult} testingGps={testingGps}
          onForceStart={forceStartTrip} onForceStop={forceStopTrip} onGpsTest={testGps}
          refreshing={tripRefreshing} onRefresh={handleTripRefresh}
        />
      )}
      {tab === 'history' && <HistoryTab historyData={historyData} colors={colors} onRefresh={loadHistory} />}
      {tab === 'logs' && (
        <LogsTab
          logs={consoleLogs} filter={logFilter} onFilterChange={setLogFilter}
          scrollRef={logScrollRef} colors={colors}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1,
  },
  back: { width: 60 },
  backText: { fontSize: 16 },
  title: { fontSize: 18, fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabLabel: { fontSize: 13, fontWeight: '500' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 2, borderRadius: 1 },
  tabScroll: { flex: 1 },
  tabContent: { padding: 12, gap: 12 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
  cardTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 12, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bigLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  bigLabel: { fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  bigConf: { fontSize: 16, fontWeight: '600' },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 },
  confLabel: { width: 36, fontSize: 11, fontWeight: '600' },
  confTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  confFill: { height: 8 },
  confPct: { width: 36, fontSize: 11, textAlign: 'right' },
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
  mono: { fontSize: 11, fontFamily: 'monospace', lineHeight: 18 },
  actions: { gap: 8, marginTop: 4 },
  btn: { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  logToolbar: { flexDirection: 'row', padding: 8, gap: 6, borderBottomWidth: 1, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#374151' },
  filterText: { fontSize: 11, fontWeight: '600' },
  logScroll: { flex: 1, padding: 8 },
  logLine: { fontSize: 10, fontFamily: 'monospace', lineHeight: 16 },
  windowRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  windowLabel: { fontSize: 13, fontWeight: '600', width: 70 },
  windowConf: { fontSize: 12, width: 40, textAlign: 'right' },
  windowTime: { fontSize: 11, flex: 1, textAlign: 'right' },
  tripRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tripRowLeft: { flex: 1 },
  tripRowRight: { alignItems: 'flex-end' },
  tripType: { fontSize: 13, fontWeight: '500' },
  tripMeta: { fontSize: 11 },
  tripDist: { fontSize: 13, fontWeight: '500' },
  tripMethod: { fontSize: 11, fontWeight: '600' },
});
