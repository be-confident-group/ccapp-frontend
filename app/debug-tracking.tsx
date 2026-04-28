/**
 * Debug Tracking Screen — tabbed ML debug view
 * Tab 1 Live:     TrackingCoordinator status + activity events (polls every 1.5 s)
 * Tab 2 Trip:     active trip + backfill delta + permissions
 * Tab 3 History:  recent motion segments (last 30)
 * Tab 4 Disagree: ClassifierDisagreement rows (last 30)
 * Tab 5 Logs:     live console log viewer
 */

import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert, RefreshControl,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { database } from '@/lib/database';
import type { ClassifierDisagreement, MotionSegment } from '@/lib/database';
import { calculateDistance, type Coordinate } from '@/lib/utils/geoCalculations';
import { TrackingCoordinator } from '@/lib/services/TrackingCoordinator';
import type { TrackingStatus, ActivityChangedEvent, StateChangedEvent, NativeLogEntry } from '@/lib/native/RadziTracker';
import { RadziTrackerNative } from '@/lib/native/RadziTracker';
import { useTheme } from '@/contexts/ThemeContext';
import { onTrackingLog, getTrackingLogBuffer, clearTrackingLogBuffer, type LogEntry } from '@/lib/services/TrackingLogger';
import type { ActivityClass } from '@/lib/activity/classifier';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'live' | 'trip' | 'history' | 'disagree' | 'logs';

interface TripTabData {
  stateLabel: string;
  activeTripId: string | null;
  activeTrip: {
    id: string;
    startTime: string;
    duration: string;
    distanceMeters: number;
    gpsPointCount: number;
    type: string;
    classMethod: string;
    backfillDelta: number | null;
  } | null;
  permissions: { location: string; motion: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LABEL_COLORS: Record<string, string> = {
  walking: '#22C55E',
  cycling: '#3B82F6',
  running: '#F97316',
  vehicle: '#EF4444',
  automotive: '#EF4444',
  stationary: '#9CA3AF',
  unknown: '#6B7280',
};

function pct(v: number) { return `${(v * 100).toFixed(0)}%`; }

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

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

// ─── Tab 1: Live ─────────────────────────────────────────────────────────────

function LiveTab({ status, lastActivity, stateHistory, colors }: {
  status: TrackingStatus | null;
  lastActivity: ActivityChangedEvent | null;
  stateHistory: StateChangedEvent[];
  colors: any;
}) {
  const isRecording = status?.state === 'recording';
  const isDetecting = status?.state === 'detecting';

  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent}>

      <Card title="TRACKING STATUS" colors={colors}>
        <View style={s.statusRow}>
          <StatusDot on={isRecording} warn={isDetecting} />
          <Text style={[s.statusText, { color: colors.text }]}>
            {status ? status.state.toUpperCase() : 'Loading…'}
          </Text>
        </View>
        {status && (
          <>
            <Row label="Engine" value="native" valueColor="#3B82F6" colors={colors} />
            <Row label="Activity" value={status.activity} valueColor={LABEL_COLORS[status.activity]} colors={colors} />
            {status.tripId ? (
              <Row label="Trip ID" value={status.tripId.slice(0, 22) + '…'} colors={colors} />
            ) : null}
            {status.gpsAccuracyMode && (
              <Row label="GPS mode" value={status.gpsAccuracyMode} colors={colors} />
            )}
          </>
        )}
        {!status && (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No native status (legacy engine or not init)</Text>
        )}
      </Card>

      <Card title="LAST ACTIVITY EVENT" colors={colors}>
        {lastActivity ? (
          <>
            <View style={[s.bigLabelRow, { borderColor: LABEL_COLORS[lastActivity.activity] ?? colors.border }]}>
              <Text style={[s.bigLabel, { color: LABEL_COLORS[lastActivity.activity] ?? colors.text }]}>
                {lastActivity.activity.toUpperCase()}
              </Text>
              {lastActivity.confidence != null && (
                <Text style={[s.bigConf, { color: colors.textSecondary }]}>
                  {lastActivity.confidence}
                </Text>
              )}
            </View>
            <Row
              label="Time"
              value={new Date(lastActivity.timestamp).toLocaleTimeString()}
              colors={colors}
            />
          </>
        ) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No activity event yet</Text>
        )}
      </Card>

      <Card title="STATE HISTORY (last 20)" colors={colors}>
        {stateHistory.length ? stateHistory.slice().reverse().map((e, i) => (
          <View key={i} style={[s.windowRow, { borderBottomColor: colors.border }]}>
            <Text style={[s.windowLabel, { color: colors.text }]}>{e.state}</Text>
            <Text style={[s.windowTime, { color: colors.textSecondary }]}>
              {new Date(e.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No state changes yet</Text>
        )}
      </Card>

    </ScrollView>
  );
}

// ─── Tab 2: Trip ─────────────────────────────────────────────────────────────

function TripTab({
  tripTabData, colors, refreshing, onRefresh, onForceStart, onForceStop,
}: {
  tripTabData: TripTabData | null; colors: any;
  refreshing: boolean; onRefresh: () => void;
  onForceStart: () => void; onForceStop: () => void;
}) {
  return (
    <ScrollView
      style={s.tabScroll}
      contentContainerStyle={s.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card title="COORDINATOR STATE" colors={colors}>
        <Row label="State" value={tripTabData?.stateLabel ?? '…'} colors={colors} />
        <Row
          label="Active trip"
          value={tripTabData?.activeTripId
            ? tripTabData.activeTripId.slice(0, 22) + '…'
            : 'none'}
          colors={colors}
        />
        <Row
          label="Location perm."
          value={tripTabData?.permissions.location ?? '?'}
          valueColor={tripTabData?.permissions.location === 'granted' ? '#22C55E' : '#F59E0B'}
          colors={colors}
        />
        <Row
          label="Motion perm."
          value={tripTabData?.permissions.motion ?? '?'}
          valueColor={tripTabData?.permissions.motion === 'granted' ? '#22C55E' : '#F59E0B'}
          colors={colors}
        />
      </Card>

      {tripTabData?.activeTrip ? (
        <Card title="ACTIVE TRIP" colors={colors}>
          <Row label="ID" value={tripTabData.activeTrip.id} colors={colors} />
          <Row label="Type" value={tripTabData.activeTrip.type} colors={colors} />
          <Row
            label="Method"
            value={tripTabData.activeTrip.classMethod}
            valueColor={
              tripTabData.activeTrip.classMethod === 'ml' ? '#22C55E' :
              tripTabData.activeTrip.classMethod === 'live' ? '#3B82F6' :
              '#F59E0B'
            }
            colors={colors}
          />
          <Row label="Started" value={tripTabData.activeTrip.startTime} colors={colors} />
          <Row label="Duration" value={tripTabData.activeTrip.duration} colors={colors} />
          <Row
            label="Distance"
            value={`${(tripTabData.activeTrip.distanceMeters / 1000).toFixed(3)} km`}
            colors={colors}
          />
          <Row
            label="GPS pts"
            value={String(tripTabData.activeTrip.gpsPointCount)}
            valueColor={tripTabData.activeTrip.gpsPointCount > 0 ? '#22C55E' : '#F59E0B'}
            colors={colors}
          />
          {tripTabData.activeTrip.backfillDelta != null && (
            <Row
              label="Backfill Δ"
              value={fmtMs(tripTabData.activeTrip.backfillDelta)}
              valueColor="#F59E0B"
              colors={colors}
            />
          )}
        </Card>
      ) : (
        <Card title="ACTIVE TRIP" colors={colors}>
          <Text style={[s.empty, { color: colors.textSecondary }]}>No active trip</Text>
        </Card>
      )}

      <View style={s.actions}>
        <Pressable style={[s.btn, { backgroundColor: '#22C55E' }]} onPress={onForceStart}>
          <Text style={s.btnText}>Force Start Trip</Text>
        </Pressable>
        <Pressable style={[s.btn, { backgroundColor: '#EF4444' }]} onPress={onForceStop}>
          <Text style={s.btnText}>Force Stop Trip</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ─── Tab 3: History ───────────────────────────────────────────────────────────

function HistoryTab({ segments, colors, onRefresh }: {
  segments: MotionSegment[]; colors: any; onRefresh: () => void;
}) {
  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent}>
      <Pressable style={[s.btn, { backgroundColor: colors.primary, marginBottom: 4 }]} onPress={onRefresh}>
        <Text style={s.btnText}>Refresh</Text>
      </Pressable>

      <Card title="RECENT MOTION SEGMENTS (last 30)" colors={colors}>
        {segments.length ? segments.map((seg, i) => (
          <View key={seg.id ?? i} style={[s.windowRow, { borderBottomColor: colors.border }]}>
            <Text style={[s.windowLabel, { color: LABEL_COLORS[seg.activity] ?? colors.text }]}>
              {seg.activity}
            </Text>
            <Text style={[s.windowConf, { color: colors.textSecondary }]}>{seg.confidence}</Text>
            <Text style={[s.windowTime, { color: colors.textSecondary }]}>
              {new Date(seg.t_start).toLocaleTimeString()} · {seg.source}
            </Text>
          </View>
        )) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No motion segments yet</Text>
        )}
      </Card>
    </ScrollView>
  );
}

// ─── Tab 4: Disagreements ────────────────────────────────────────────────────

function DisagreementsTab({ rows, colors, onRefresh }: {
  rows: ClassifierDisagreement[]; colors: any; onRefresh: () => void;
}) {
  return (
    <ScrollView style={s.tabScroll} contentContainerStyle={s.tabContent}>
      <Pressable style={[s.btn, { backgroundColor: colors.primary, marginBottom: 4 }]} onPress={onRefresh}>
        <Text style={s.btnText}>Refresh</Text>
      </Pressable>

      <Card title="CLASSIFIER DISAGREEMENTS (last 30)" colors={colors}>
        {rows.length ? rows.map((r, i) => (
          <View key={r.id ?? i} style={[s.disagRow, { borderBottomColor: colors.border }]}>
            <View style={s.disagLabels}>
              <Text style={[s.disagCmma, { color: LABEL_COLORS[r.cmma_label] ?? colors.text }]}>
                {r.cmma_label}
              </Text>
              <Text style={[s.disagArrow, { color: colors.textSecondary }]}>→</Text>
              <Text style={[s.disagXgb, { color: LABEL_COLORS[r.xgb_label] ?? colors.text }]}>
                {r.xgb_label}
              </Text>
              <Text style={[s.disagConf, { color: colors.textSecondary }]}>
                {pct(r.xgb_conf)}
              </Text>
            </View>
            <Text style={[s.disagTime, { color: colors.textSecondary }]}>
              {new Date(r.t).toLocaleTimeString()}
            </Text>
          </View>
        )) : (
          <Text style={[s.empty, { color: colors.textSecondary }]}>No disagreements recorded yet</Text>
        )}
      </Card>
    </ScrollView>
  );
}

// ─── Tab 5: Logs ─────────────────────────────────────────────────────────────

function LogsTab({ logs, nativeLogs, filter, onFilterChange, onRefresh, scrollRef, colors }: {
  logs: LogEntry[];
  nativeLogs: NativeLogEntry[];
  filter: 'all' | 'info' | 'warn' | 'error';
  onFilterChange: (f: 'all' | 'info' | 'warn' | 'error') => void;
  onRefresh: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  colors: any;
}) {
  type CombinedEntry = { timestamp: number; level: string; message: string; src: 'js' | 'native' };
  const combined: CombinedEntry[] = [
    ...logs.map(l => ({ ...l, src: 'js' as const })),
    ...nativeLogs.map(l => ({ ...l, src: 'native' as const })),
  ].sort((a, b) => a.timestamp - b.timestamp);

  const filtered = filter === 'all' ? combined : combined.filter(l => l.level === filter);

  function logColor(level: string): string {
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
        <Pressable style={[s.filterBtn, { backgroundColor: colors.primary }]} onPress={onRefresh}>
          <Text style={[s.filterText, { color: '#fff' }]}>↻</Text>
        </Pressable>
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
            {fmtTime(entry.timestamp)} [{entry.src === 'native' ? 'SW' : 'JS'}] {entry.message}
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

  // ── Tab 1: Live — polls every 1.5 s, subscribes to events ──
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [lastActivity, setLastActivity] = useState<ActivityChangedEvent | null>(null);
  const [stateHistory, setStateHistory] = useState<StateChangedEvent[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await TrackingCoordinator.getStatus();
        if ('state' in s) setStatus(s as TrackingStatus);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1500);
    const unsubAct = TrackingCoordinator.onActivityChange(setLastActivity);
    const unsubState = TrackingCoordinator.onStateChange(e =>
      setStateHistory(prev => [...prev.slice(-19), e])
    );
    return () => { clearInterval(id); unsubAct(); unsubState(); };
  }, []);

  // ── Tab 2: Trip ──
  const [tripTabData, setTripTabData] = useState<TripTabData | null>(null);
  const [tripRefreshing, setTripRefreshing] = useState(false);

  const loadTripData = async () => {
    try {
      const s = await TrackingCoordinator.getStatus();
      const stateLabel = 'state' in s ? (s as TrackingStatus).state : 'legacy';
      const activeTripId = ('tripId' in s ? (s as any).tripId : null) as string | null;

      let activeTrip: TripTabData['activeTrip'] = null;
      if (activeTripId) {
        const trip = await database.getTripById(activeTripId);
        if (trip) {
          const elapsed = Date.now() - trip.start_time;
          let backfillDelta: number | null = null;
          if ((trip as any).backfill_start && trip.start_time) {
            backfillDelta = trip.start_time - (trip as any).backfill_start;
          }

          // Compute live distance from stored GPS points
          let distanceMeters = 0;
          let gpsPointCount = 0;
          try {
            const locations = await database.getLocationsByTrip(activeTripId);
            gpsPointCount = locations.length;
            for (let i = 1; i < locations.length; i++) {
              const from: Coordinate = { latitude: locations[i - 1].latitude, longitude: locations[i - 1].longitude };
              const to: Coordinate   = { latitude: locations[i].latitude,     longitude: locations[i].longitude };
              distanceMeters += calculateDistance(from, to);
            }
          } catch { /* non-fatal */ }

          const isNativeActive = (trip as any).engine === 'native' && trip.status === 'active';
          activeTrip = {
            id: trip.id.slice(0, 22) + '…',
            startTime: new Date(trip.start_time).toLocaleTimeString(),
            duration: fmtMs(elapsed),
            distanceMeters,
            gpsPointCount,
            type: trip.type || '?',
            classMethod: isNativeActive ? 'live' : (trip.classification_method || 'speed'),
            backfillDelta,
          };
        }
      }

      const permissions = await TrackingCoordinator.checkPermissions();
      setTripTabData({
        stateLabel,
        activeTripId,
        activeTrip,
        permissions: {
          location: permissions.location,
          motion: permissions.motion,
        },
      });
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

  // ── Tab 3: History ──
  const [motionSegments, setMotionSegments] = useState<MotionSegment[]>([]);

  const loadHistory = async () => {
    try {
      const segs = await database.getRecentMotionSegments(30);
      setMotionSegments(segs);
    } catch (err) {
      console.error('[DebugTracking] History tab error:', err);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab]);

  // ── Tab 4: Disagreements ──
  const [disagRows, setDisagRows] = useState<ClassifierDisagreement[]>([]);

  const loadDisag = async () => {
    try {
      setDisagRows(await database.getRecentDisagreements(30));
    } catch (err) {
      console.error('[DebugTracking] Disagreements tab error:', err);
    }
  };

  useEffect(() => {
    if (tab === 'disagree') loadDisag();
  }, [tab]);

  // ── Tab 5: Logs ──
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [nativeLogs, setNativeLogs] = useState<NativeLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const logScrollRef = useRef<ScrollView>(null);

  const refreshNativeLogs = async () => {
    try {
      const entries = await RadziTrackerNative.getLogs();
      setNativeLogs(entries);
    } catch {}
  };

  useEffect(() => {
    setConsoleLogs(getTrackingLogBuffer());
    const unsub = onTrackingLog(entry => setConsoleLogs(prev => [...prev.slice(-199), entry]));
    refreshNativeLogs();
    const id = setInterval(refreshNativeLogs, 2000);
    return () => { unsub(); clearInterval(id); };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const forceStartTrip = async () => {
    try {
      const result = await TrackingCoordinator.forceStartTrip();
      Alert.alert('Trip Started', `ID: ${result.tripId.slice(0, 25)}…`);
      loadTripData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown');
    }
  };

  const forceStopTrip = async () => {
    try {
      await TrackingCoordinator.forceStopTrip();
      Alert.alert('Trip Stopped');
      loadTripData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Unknown');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: 'live', label: 'Live' },
    { key: 'trip', label: 'Trip' },
    { key: 'history', label: 'History' },
    { key: 'disagree', label: 'Disagree' },
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
        <Pressable onPress={() => { refreshNativeLogs(); loadTripData(); }} style={s.back}>
          <Text style={[s.backText, { color: colors.primary }]}>↻</Text>
        </Pressable>
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
      {tab === 'live' && (
        <LiveTab
          status={status}
          lastActivity={lastActivity}
          stateHistory={stateHistory}
          colors={colors}
        />
      )}
      {tab === 'trip' && (
        <TripTab
          tripTabData={tripTabData}
          colors={colors}
          refreshing={tripRefreshing}
          onRefresh={handleTripRefresh}
          onForceStart={forceStartTrip}
          onForceStop={forceStopTrip}
        />
      )}
      {tab === 'history' && (
        <HistoryTab segments={motionSegments} colors={colors} onRefresh={loadHistory} />
      )}
      {tab === 'disagree' && (
        <DisagreementsTab rows={disagRows} colors={colors} onRefresh={loadDisag} />
      )}
      {tab === 'logs' && (
        <LogsTab
          logs={consoleLogs} nativeLogs={nativeLogs}
          filter={logFilter} onFilterChange={setLogFilter}
          onRefresh={refreshNativeLogs}
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
  tabLabel: { fontSize: 12, fontWeight: '500' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 4, right: 4, height: 2, borderRadius: 1 },
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
  empty: { fontSize: 13, fontStyle: 'italic', paddingVertical: 4 },
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
  windowLabel: { fontSize: 13, fontWeight: '600', width: 80 },
  windowConf: { fontSize: 12, width: 44, textAlign: 'center' },
  windowTime: { fontSize: 11, flex: 1, textAlign: 'right' },
  disagRow: {
    paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disagLabels: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  disagCmma: { fontSize: 13, fontWeight: '600' },
  disagArrow: { fontSize: 12 },
  disagXgb: { fontSize: 13, fontWeight: '600', flex: 1 },
  disagConf: { fontSize: 12 },
  disagTime: { fontSize: 11 },
});
