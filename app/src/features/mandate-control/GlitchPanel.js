import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Wifi, Clock, AlertTriangle, Zap } from 'lucide-react-native';

const MODES = [
  {
    id: 'off',
    icon: Wifi,
    title: 'CLEAN',
    desc: 'Normal',
    detail: 'All API calls return healthy responses without interference.',
    accent: '#34C759',
    tag: 'NO FAULT',
  },
  {
    id: 'latency',
    icon: Clock,
    title: 'SLOW',
    desc: '+800ms',
    detail: 'Server inserts an 800ms delay before responding to every probe.',
    accent: '#FFD60A',
    tag: 'LATENCY',
  },
  {
    id: 'error',
    icon: AlertTriangle,
    title: 'ERROR',
    desc: 'HTTP 503',
    detail: 'Server replies with 503 Service Unavailable on every probe hit.',
    accent: '#FF453A',
    tag: 'HTTP ERROR',
  },
  {
    id: 'timeout',
    icon: Zap,
    title: 'TIMEOUT',
    desc: '>4s hang',
    detail: 'Server stalls; worker clients abort after their 4-second deadline.',
    accent: '#BF5AF2',
    tag: 'TIMEOUT',
  },
];

export function GlitchPanel({ lab }) {
  const { glitchMode, applyGlitch, stats, running } = lab;
  const active = MODES.find((m) => m.id === glitchMode) || MODES[0];
  const fail = (stats.errors || 0) + (stats.timeouts || 0);

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Active fault hero ── */}
      <View style={[styles.hero, { borderColor: `${active.accent}33` }]}>
        <View style={[styles.heroIconWrap, { backgroundColor: `${active.accent}18` }]}>
          {React.createElement(active.icon, { size: 28, color: active.accent })}
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: active.accent }]}>{active.title}</Text>
          <Text style={styles.heroDesc}>{active.detail}</Text>
        </View>
      </View>

      {/* ── Mode list ── */}
      <View style={styles.modeList}>
        {MODES.map((mode) => {
          const on = glitchMode === mode.id;
          const Icon = mode.icon;
          return (
            <Pressable
              key={mode.id}
              onPress={() => applyGlitch(mode.id)}
              style={[styles.modeRow, on && { borderColor: `${mode.accent}50` }]}
            >
              <View style={[styles.modeAccentBar, { backgroundColor: on ? mode.accent : 'transparent' }]} />
              <View style={[styles.modeIconBox, { backgroundColor: on ? `${mode.accent}15` : '#111111' }]}>
                <Icon size={16} color={on ? mode.accent : '#555555'} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={[styles.modeTitle, on && { color: mode.accent }]}>{mode.title}</Text>
                <Text style={styles.modeDesc}>{mode.desc}</Text>
              </View>
              <View style={[styles.modeTag, on && { backgroundColor: `${mode.accent}18`, borderColor: `${mode.accent}40` }]}>
                <Text style={[styles.modeTagText, on && { color: mode.accent }]}>{mode.tag}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* ── Impact stats ── */}
      <View style={styles.impactBlock}>
        <Text style={styles.blockLabel}>FAULT IMPACT</Text>
        <View style={styles.impactGrid}>
          <ImpactCard label="FAILURES" value={String(fail)} color={fail > 0 ? '#FF453A' : '#3A3A3C'} />
          <ImpactCard label="TIMEOUTS" value={String(stats.timeouts || 0)} color={stats.timeouts > 0 ? '#BF5AF2' : '#3A3A3C'} />
          <ImpactCard label="LAST PATH" value={stats.lastPath || '—'} color="#6B6B6B" small />
          <ImpactCard label="LAST STATUS" value={stats.lastStatus ? String(stats.lastStatus) : '—'} color={stats.lastStatus >= 400 ? '#FF453A' : '#34C759'} />
        </View>
      </View>

      {/* ── Workers status ── */}
      <View style={styles.workerStatus}>
        <View style={styles.workerStatusRow}>
          <View style={[styles.workerDot, { backgroundColor: running ? '#34C759' : '#2A2A2A' }]} />
          <Text style={styles.workerStatusText}>
            Workers are {running ? 'active — fault applies immediately' : 'idle — start them from the Traffic panel'}
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Faults are injected server-side. Chat, grants and payments run on separate routes and are never affected.
      </Text>
    </ScrollView>
  );
}

function ImpactCard({ label, value, color, small }) {
  return (
    <View style={styles.impactCard}>
      <Text style={[styles.impactVal, { color, fontSize: small ? 13 : 22 }]}>{value}</Text>
      <Text style={styles.impactLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, backgroundColor: '#060606' },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 48, gap: 20 },

  blockLabel: {
    color: '#3A3A3C', fontSize: 10, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2,
  },

  /* hero */
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#0D0D0D',
    borderWidth: 1, borderRadius: 12,
    padding: 18,
  },
  heroIconWrap: {
    width: 56, height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 22, fontWeight: '700', fontFamily: 'monospace' },
  heroDesc: { color: '#6B6B6B', fontSize: 12, lineHeight: 18 },

  /* mode list */
  modeList: { gap: 6 },
  modeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0D0D',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, overflow: 'hidden',
    paddingRight: 14, paddingVertical: 12,
  },
  modeAccentBar: { width: 3, alignSelf: 'stretch' },
  modeIconBox: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  modeInfo: { flex: 1 },
  modeTitle: { color: '#8E8E93', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  modeDesc: { color: '#3A3A3C', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  modeTag: {
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: '#111111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
  },
  modeTagText: { color: '#555555', fontSize: 9, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 0.8 },

  /* impact */
  impactBlock: { gap: 10 },
  impactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  impactCard: {
    width: '47%',
    backgroundColor: '#0D0D0D',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 14, gap: 4,
  },
  impactVal: { fontFamily: 'monospace', fontWeight: '200' },
  impactLbl: { color: '#3A3A3C', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' },

  /* worker status */
  workerStatus: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: 14,
  },
  workerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  workerDot: { width: 8, height: 8, borderRadius: 4 },
  workerStatusText: { color: '#555555', fontSize: 11, fontFamily: 'monospace', flex: 1, lineHeight: 16 },

  footer: {
    color: '#2A2A2A', fontSize: 10, lineHeight: 16, fontFamily: 'monospace',
  },
});
