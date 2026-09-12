import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Play, Square, RotateCcw } from 'lucide-react-native';

const COUNTS = [1, 2, 3, 5, 8];
const INTENSITIES = [
  { id: 'low',    label: 'LOW',  sub: '700ms / req',  segs: 1 },
  { id: 'medium', label: 'MED',  sub: '280ms / req',  segs: 2 },
  { id: 'high',   label: 'HIGH', sub: '90ms / req',   segs: 3 },
];

export function TrafficSimulatorPanel({ lab }) {
  const {
    running, workerCount, setWorkerCount,
    intensity, setIntensity,
    stats, error,
    startWorkers, stopWorkers, resetStats,
  } = lab;

  // Hosting throttles (429 from the EAS free tier) are deliberately NOT
  // failures — they say nothing about Layer 0's health, and folding them in
  // made a plan limit look exactly like the injected fault's effect.
  const fail   = (stats.errors || 0) + (stats.timeouts || 0);
  const throttled = stats.throttled || 0;
  const served = Math.max(0, (stats.total || 0) - throttled);
  const health = served ? Math.round((stats.ok / served) * 100) : 100;
  const healthColor = health > 80 ? '#34C759' : health > 50 ? '#FFD60A' : '#FF453A';

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Worker count ── */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>AGENTS{running ? ' (stop workers to change)' : ''}</Text>
        <View style={styles.agentRow}>
          {COUNTS.map((n) => {
            const on = workerCount === n;
            return (
              <Pressable
                key={n}
                disabled={running}
                onPress={() => setWorkerCount(n)}
                style={[styles.agentBtn, on && styles.agentBtnOn, running && styles.agentBtnDisabled]}
              >
                <Text style={[styles.agentNum, on && styles.agentNumOn]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Intensity ── */}
      <View style={styles.block}>
        <Text style={styles.blockLabel}>INTENSITY{running ? ' (stop workers to change)' : ''}</Text>
        <View style={styles.intensityRow}>
          {INTENSITIES.map((item) => {
            const on = intensity === item.id;
            return (
              <Pressable
                key={item.id}
                disabled={running}
                onPress={() => setIntensity(item.id)}
                style={[styles.intBtn, on && styles.intBtnOn, running && styles.intBtnDisabled]}
              >
                <View style={styles.intSegs}>
                  {[1,2,3].map((s) => (
                    <View key={s} style={[styles.intSeg, (on || s <= item.segs) && s <= item.segs && styles.intSegOn]} />
                  ))}
                </View>
                <Text style={[styles.intLabel, on && styles.intLabelOn]}>{item.label}</Text>
                <Text style={[styles.intSub, on && styles.intSubOn]}>{item.sub}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── CTA ── */}
      <Pressable
        style={[styles.cta, running && styles.ctaRunning]}
        onPress={running ? stopWorkers : startWorkers}
      >
        {running ? (
          <>
            <Square size={16} color="#FF453A" />
            <Text style={[styles.ctaLabel, { color: '#FF453A' }]}>STOP ALL WORKERS</Text>
            <View style={styles.ctaPulse} />
          </>
        ) : (
          <>
            <Play size={16} color="#000000" />
            <Text style={styles.ctaLabel}>START WORKERS</Text>
          </>
        )}
      </Pressable>

      {/* ── Stats ── */}
      <View style={styles.statsGrid}>
        <Stat label="RPS"   value={String(stats.rps  ?? 0)} color="#34C759" />
        <Stat label="TOTAL" value={String(stats.total ?? 0)} color="#E5E5EA" />
        <Stat label="OK"    value={String(stats.ok   ?? 0)} color="#34C759" />
        <Stat label="FAIL"  value={String(fail)}             color={fail > 0 ? '#FF453A' : '#3A3A3C'} />
      </View>

      {/* ── Health bar ── */}
      <View style={styles.healthWrap}>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabelLeft}>SUCCESS RATE</Text>
          <Text style={[styles.healthPct, { color: healthColor }]}>{health}%</Text>
        </View>
        <View style={styles.healthTrack}>
          <View style={[styles.healthFill, { width: `${health}%`, backgroundColor: healthColor }]} />
        </View>
        <Text style={styles.healthSub}>
          avg {stats.avgLatencyMs || 0}ms latency · last {stats.lastPath || '—'}
          {throttled > 0 ? ` · ${throttled} throttled by hosting plan` : ''}
        </Text>
      </View>

      {/* ── Reset ── */}
      <Pressable style={styles.resetRow} onPress={resetStats}>
        <RotateCcw size={11} color="#3A3A3C" />
        <Text style={styles.resetText}>RESET COUNTERS</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* ── Live terminal log ── */}
      <View style={styles.logHeader}>
        <Text style={styles.blockLabel}>LIVE LOG</Text>
        {running && (
          <View style={styles.logLive}>
            <View style={styles.logLiveDot} />
            <Text style={styles.logLiveText}>STREAMING</Text>
          </View>
        )}
      </View>

      <View style={styles.terminal}>
        {(!stats.events || stats.events.length === 0) ? (
          <Text style={styles.termEmpty}>{'> no traffic yet. start workers.'}</Text>
        ) : (
          (stats.events || []).slice(0, 14).map((ev) => <TermLine key={ev.id} ev={ev} />)
        )}
      </View>

      {running && (
        <View style={styles.nextHint}>
          <Text style={styles.nextHintText}>
            → Next: open GLITCH (right edge) and inject a fault. The agent will detect it and autonomously pay a real sponsor to fail over — watch it happen in Agent Chat.
          </Text>
        </View>
      )}

    </ScrollView>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function TermLine({ ev }) {
  const ok = ev.ok;
  const color = ev.throttled ? '#8E8E93' : ev.timeout ? '#FFD60A' : ok ? '#34C759' : '#FF453A';
  const prefix = ev.throttled ? '⇥' : ev.timeout ? '⏱' : ok ? '✓' : '✗';
  return (
    <View style={styles.termLine}>
      <Text style={[styles.termPrefix, { color }]}>{prefix}</Text>
      <Text style={styles.termWorker}>{ev.worker}</Text>
      <Text style={[styles.termPath, !ok && { color: '#FF6B6B' }]}>{ev.path}</Text>
      <Text style={[styles.termStatus, { color }]}>{ev.status}</Text>
      <Text style={styles.termMs}>{ev.latencyMs}ms</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#060606' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48, gap: 20 },

  block: { gap: 10 },
  blockLabel: {
    color: '#3A3A3C', fontSize: 10, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2,
  },

  /* agents */
  agentRow: { flexDirection: 'row', gap: 8 },
  agentBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  agentBtnOn: { backgroundColor: 'rgba(52,199,89,0.12)', borderColor: '#34C759' },
  agentBtnDisabled: { opacity: 0.4 },
  agentNum: { color: '#555555', fontSize: 16, fontFamily: 'monospace', fontWeight: '300' },
  agentNumOn: { color: '#34C759', fontWeight: '600' },

  /* intensity */
  intensityRow: { flexDirection: 'row', gap: 8 },
  intBtn: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8,
    alignItems: 'center', gap: 6,
    backgroundColor: '#111111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  intBtnOn: { backgroundColor: 'rgba(52,199,89,0.10)', borderColor: 'rgba(52,199,89,0.4)' },
  intBtnDisabled: { opacity: 0.4 },
  intSegs: { flexDirection: 'row', gap: 3 },
  intSeg: { width: 8, height: 3, borderRadius: 2, backgroundColor: '#2A2A2A' },
  intSegOn: { backgroundColor: '#34C759' },
  intLabel: { color: '#555555', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  intLabelOn: { color: '#34C759' },
  intSub: { color: '#3A3A3C', fontSize: 9, fontFamily: 'monospace' },
  intSubOn: { color: 'rgba(52,199,89,0.5)' },

  /* cta */
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  ctaRunning: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.35)',
  },
  ctaLabel: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1, color: '#000000' },
  ctaPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF453A' },

  /* stats */
  statsGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: '#0D0D0D',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, paddingVertical: 14, paddingHorizontal: 10,
    alignItems: 'center', gap: 4,
  },
  statVal: { fontSize: 26, fontFamily: 'monospace', fontWeight: '200' },
  statLbl: { color: '#3A3A3C', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' },

  /* health */
  healthWrap: { gap: 6 },
  healthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  healthLabelLeft: { color: '#3A3A3C', fontSize: 10, fontFamily: 'monospace', letterSpacing: 2, fontWeight: '700' },
  healthPct: { fontSize: 13, fontFamily: 'monospace', fontWeight: '700' },
  healthTrack: { height: 5, backgroundColor: '#1C1C1E', borderRadius: 3, overflow: 'hidden' },
  healthFill: { height: '100%', borderRadius: 3 },
  healthSub: { color: '#3A3A3C', fontSize: 10, fontFamily: 'monospace' },

  /* reset */
  resetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 },
  resetText: { color: '#3A3A3C', fontSize: 10, fontFamily: 'monospace', letterSpacing: 0.5 },

  errorText: { color: '#FF453A', fontSize: 11, fontFamily: 'monospace' },

  /* log */
  logHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logLive: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  logLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF453A' },
  logLiveText: { color: '#FF453A', fontSize: 9, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 1 },

  terminal: {
    backgroundColor: '#030303', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    padding: 12, gap: 3,
  },
  termEmpty: { color: '#2A2A2A', fontSize: 11, fontFamily: 'monospace' },
  termLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  termPrefix: { fontSize: 10, width: 12, textAlign: 'center' },
  termWorker: { color: '#3A3A3C', fontSize: 9, fontFamily: 'monospace', width: 64 },
  termPath: { color: '#6B6B6B', fontSize: 10, fontFamily: 'monospace', flex: 1 },
  termStatus: { fontSize: 10, fontFamily: 'monospace', fontWeight: '700', width: 30, textAlign: 'right' },
  termMs: { color: '#3A3A3C', fontSize: 9, fontFamily: 'monospace', width: 38, textAlign: 'right' },

  nextHint: {
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.25)',
    borderRadius: 10, padding: 12,
  },
  nextHintText: {
    color: '#8FE3A6', fontSize: 11, lineHeight: 16, fontFamily: 'monospace',
  },
});
