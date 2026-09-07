import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export function InternalHealthTab({ treasury, budget, unallocated, treasuryStatus, mandateFunded, stats, running }) {
  const fail = (stats.errors || 0) + (stats.timeouts || 0);
  const live = running || (stats.rps || 0) > 0;

  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>MANDATE PLATFORM</Text>
        <Text style={styles.tabSubtitle}>
          {live ? 'Live HTTP from traffic workers to /api/health, /api/traffic/probe, and /api/treasury/balances' : 'Start workers from the left Edge panel to generate real API traffic'}
        </Text>
      </View>
      <View style={styles.metricGrid}>
        <Card label="TREASURY" value={treasuryStatus === 'loading' ? '…' : treasuryStatus === 'error' ? 'ERR' : `$${treasury.toFixed(2)}`} hint="Arc Testnet USDC" />
        <Card label="AGENT BUDGET" value={`$${budget.toFixed(2)}`} hint={mandateFunded ? 'Spendable Mandate' : 'Not granted'} />
        <Card label="UNALLOCATED" value={`$${unallocated.toFixed(2)}`} hint="Available to grant" />
        <Card label="API RPS" value={String(stats.rps ?? 0)} hint={live ? 'Measured last 5s' : 'Workers idle'} accent={live ? '#34C759' : '#8E8E93'} />
        <Card label="REQUESTS" value={String(stats.total ?? 0)} hint={`OK ${stats.ok || 0} · fail ${fail}`} />
        <Card label="AVG LATENCY" value={`${stats.avgLatencyMs || 0}ms`} hint={`Last ${stats.lastLatencyMs || 0}ms · ${stats.lastPath || '—'}`} accent={(stats.avgLatencyMs || 0) > 2000 ? '#FF453A' : '#34C759'} />
        <Card label="HEALTH HITS" value={String(stats.byPath?.health || 0)} hint="/api/health" />
        <Card label="PROBE HITS" value={String(stats.byPath?.probe || 0)} hint="/api/traffic/probe" />
        <Card label="BALANCES HITS" value={String(stats.byPath?.balances || 0)} hint="/api/treasury/balances" />
      </View>
    </ScrollView>
  );
}

function Card({ label, value, hint, accent }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.metricStatus}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: { flex: 1, backgroundColor: '#000000', padding: 24 },
  tabHeader: { marginBottom: 32 },
  tabTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  tabSubtitle: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: '#0A0A0A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metricLabel: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 },
  metricValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginBottom: 12 },
  metricStatus: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace', fontWeight: '600' }
});
