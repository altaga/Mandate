/**
 * @file InfraStatusBar.js
 * @description Compact horizontal row of 5 service health dots for Mission Control.
 *
 * Each dot represents one Layer 0 service:
 *   green  = Layer 0 healthy
 *   yellow = SLOW (latency spike)
 *   red    = DEGRADED / CRITICAL (failover needed or in progress)
 *   blue   = Sponsor ACTIVE (paid fallback running)
 *   gray   = no data yet
 *
 * Tapping a dot expands a small inline detail row.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Zap, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react-native';

const PATH_LABELS = {
  health:     'Health',
  balances:   'Balances',
  reputation: 'Reputation',
  catalog:    'Catalog',
  reason:     'Reasoning',
  probe:      'Probe',
};

function getDotColor(svc) {
  if (!svc) return '#3A3A3C';
  if (svc.mode === 'sponsor')     return '#5090D0';  // blue — sponsor active
  if (svc.mode === 'recovering')  return '#FFD60A';  // yellow — recovering
  if (svc.severity === 'critical') return '#FF453A'; // red — degraded
  if (svc.severity === 'slow')     return '#FFD60A'; // yellow — slow
  return '#34C759';                                   // green — healthy
}

function getDotLabel(svc) {
  if (!svc) return '—';
  if (svc.mode === 'sponsor')      return svc.sponsor || 'Sponsor';
  if (svc.mode === 'recovering')   return 'Recovering';
  if (svc.severity === 'critical') return 'Degraded';
  if (svc.severity === 'slow')     return 'Slow';
  return 'OK';
}

function ServiceDot({ svc }) {
  const [expanded, setExpanded] = useState(false);
  const color = getDotColor(svc);
  const label = getDotLabel(svc);
  const path = svc?.path || '?';

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={styles.dotWrapper}>
      <View style={styles.dotRow}>
        {/* Pulse ring for sponsor-active state */}
        {svc?.mode === 'sponsor' && (
          <View style={[styles.pulseRing, { borderColor: color }]} />
        )}
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.dotLabel, { color }]}>{PATH_LABELS[path] || path}</Text>
      </View>

      {expanded && svc && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipPath}>{`/api/vendor/${path}` !== svc.path ? `/api/${path}` : svc.path || `/${path}`}</Text>
          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Mode</Text>
            <Text style={[styles.tooltipValue, { color }]}>{svc.mode?.toUpperCase()}</Text>
          </View>
          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Error rate</Text>
            <Text style={styles.tooltipValue}>{((svc.errorRate || 0) * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Avg latency</Text>
            <Text style={styles.tooltipValue}>{svc.avgLatencyMs || 0} ms</Text>
          </View>
          {svc.mode === 'sponsor' && (
            <View style={styles.tooltipRow}>
              <Text style={styles.tooltipKey}>Sponsor</Text>
              <Text style={[styles.tooltipValue, { color: '#5090D0' }]}>{svc.sponsor}</Text>
            </View>
          )}
          {svc.mode === 'recovering' && (
            <View style={styles.tooltipRow}>
              <Text style={styles.tooltipKey}>Recovery</Text>
              <Text style={styles.tooltipValue}>{svc.recoveryProbes}/{svc.recoveryNeeded} probes</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

export function InfraStatusBar({ services = [], totalSponsorCost = 0, overallStatus = 'healthy' }) {
  // Create a map for fast lookup
  const svcMap = {};
  for (const s of services) svcMap[s.path] = s;

  const paths = ['health', 'balances', 'reputation', 'catalog', 'reason', 'probe'];

  const statusColor = overallStatus === 'healthy' ? '#34C759'
                    : overallStatus === 'degraded' ? '#FF453A'
                    : '#FFD60A';

  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <View style={[styles.overallDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.overallLabel, { color: statusColor }]}>
          LAYER 0
        </Text>
      </View>

      <View style={styles.dotsRow}>
        {paths.map((p) => (
          <ServiceDot key={p} svc={svcMap[p] || { path: p }} />
        ))}
      </View>

      {totalSponsorCost > 0 && (
        <View style={styles.right}>
          <Zap size={10} color="#5090D0" />
          <Text style={styles.costLabel}>${totalSponsorCost.toFixed(5)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  overallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  overallLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  dotWrapper: {
    alignItems: 'center',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    position: 'relative',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pulseRing: {
    position: 'absolute',
    left: -3,
    top: -3,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1,
    opacity: 0.4,
  },
  dotLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  tooltip: {
    position: 'absolute',
    top: 18,
    left: -8,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    padding: 10,
    zIndex: 100,
    minWidth: 160,
  },
  tooltipPath: {
    color: '#8E8E93',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  tooltipKey: {
    color: '#6B7280',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  tooltipValue: {
    color: '#E2E8F0',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  costLabel: {
    color: '#5090D0',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
});
