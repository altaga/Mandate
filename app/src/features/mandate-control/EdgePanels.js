import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Activity, Bug, X } from 'lucide-react-native';
import { TrafficSimulatorPanel } from './TrafficSimulatorPanel';
import { GlitchPanel } from './GlitchPanel';

const PANEL_W = 340;
const TAB_W = 156;
const TAB_H = 52;
const TAB_OFFSET = -(TAB_W / 2 - TAB_H / 2); // keeps visual edge flush with screen edge

function PingDot({ color }) {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <View style={styles.pingWrap} pointerEvents="none">
      <Animated.View style={[styles.pingRing, { backgroundColor: color, opacity, transform: [{ scale }] }]} />
      <View style={[styles.pingCore, { backgroundColor: color }]} />
    </View>
  );
}

export function EdgePanels({ lab, children }) {
  const [leftOpen, setLeftOpen] = React.useState(false);
  const [rightOpen, setRightOpen] = React.useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>{children}</View>

      {/* ── LEFT SHEET ── */}
      {leftOpen && (
        <View style={[styles.sheet, styles.sheetLeft]}>
          <View style={[styles.sheetHeader, styles.sheetHeaderLeft]}>
            <View style={styles.sheetHeaderInfo}>
              <View style={styles.liveBadge}>
                <View style={[styles.liveDot, lab.running && styles.liveDotActive]} />
                <Text style={[styles.liveBadgeText, lab.running && { color: '#34C759' }]}>
                  {lab.running ? 'LIVE' : 'IDLE'}
                </Text>
              </View>
              <View>
                <Text style={styles.sheetName}>Traffic Simulator</Text>
                <Text style={styles.sheetSub}>
                  {lab.running ? `${lab.workerCount} agents · ${lab.intensity}` : 'No workers running'}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => setLeftOpen(false)} hitSlop={16} style={styles.closeBtn}>
              <X size={16} color="#555555" />
            </Pressable>
          </View>
          <TrafficSimulatorPanel lab={lab} />
        </View>
      )}

      {/* ── RIGHT SHEET ── */}
      {rightOpen && (
        <View style={[styles.sheet, styles.sheetRight]}>
          <View style={[styles.sheetHeader, styles.sheetHeaderRight]}>
            <Pressable onPress={() => setRightOpen(false)} hitSlop={16} style={styles.closeBtn}>
              <X size={16} color="#555555" />
            </Pressable>
            <View style={styles.sheetHeaderInfoRight}>
              <View>
                <Text style={[styles.sheetName, { textAlign: 'right' }]}>Fault Injector</Text>
                <Text style={[styles.sheetSub, { textAlign: 'right' }]}>
                  {lab.glitchMode === 'off' ? 'No active fault' : `Fault: ${lab.glitchMode.toUpperCase()}`}
                </Text>
              </View>
              <View style={[styles.liveBadge, {
                backgroundColor: lab.glitchMode !== 'off' ? 'rgba(255,69,58,0.12)' : 'rgba(255,255,255,0.05)',
                borderColor: lab.glitchMode !== 'off' ? 'rgba(255,69,58,0.3)' : 'rgba(255,255,255,0.1)',
              }]}>
                <View style={[styles.liveDot, { backgroundColor: lab.glitchMode !== 'off' ? '#FF453A' : '#555555' }]} />
                <Text style={[styles.liveBadgeText, { color: lab.glitchMode !== 'off' ? '#FF453A' : '#555555' }]}>
                  {lab.glitchMode !== 'off' ? 'FAULT' : 'CLEAN'}
                </Text>
              </View>
            </View>
          </View>
          <GlitchPanel lab={lab} />
        </View>
      )}

      {/* ── LEFT TAB ── */}
      <View style={[styles.tabWrap, styles.tabWrapLeft, leftOpen && { left: PANEL_W + TAB_OFFSET }]}>
        <Pressable
          onPress={() => setLeftOpen((o) => !o)}
          style={({ hovered }) => [
            styles.tab,
            styles.tabLeft,
            leftOpen && styles.tabActiveLeft,
            hovered && !leftOpen && styles.tabHoverLeft,
          ]}
        >
          <View style={styles.tabContent}>
            <Activity size={15} strokeWidth={2.25} color={leftOpen ? '#34C759' : '#4CD964'} />
            <Text style={[styles.tabText, styles.tabTextLeft, leftOpen && styles.tabTextLeftActive]}>
              TRAFFIC
            </Text>
          </View>
          {lab.running && <PingDot color="#34C759" />}
        </Pressable>
      </View>

      {/* ── RIGHT TAB ── */}
      <View style={[styles.tabWrap, styles.tabWrapRight, rightOpen && { right: PANEL_W + TAB_OFFSET }]}>
        <Pressable
          onPress={() => setRightOpen((o) => !o)}
          style={({ hovered }) => [
            styles.tab,
            styles.tabRight,
            rightOpen && styles.tabActiveRight,
            hovered && !rightOpen && styles.tabHoverRight,
          ]}
        >
          <View style={styles.tabContent}>
            <Bug size={15} strokeWidth={2.25} color={rightOpen ? '#FF453A' : '#FF6961'} />
            <Text style={[styles.tabText, styles.tabTextRight, rightOpen && styles.tabTextRightActive]}>
              GLITCH
            </Text>
          </View>
          {lab.glitchMode !== 'off' && <PingDot color="#FF453A" />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1 },

  sheet: {
    position: 'absolute', top: 0, bottom: 0,
    width: PANEL_W, zIndex: 40, elevation: 20,
  },
  sheetLeft: {
    left: 0,
    backgroundColor: '#060606',
    borderRightWidth: 1,
    borderRightColor: 'rgba(52,199,89,0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  sheetRight: {
    right: 0,
    backgroundColor: '#060606',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,69,58,0.18)',
    shadowColor: '#000000',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sheetHeaderLeft: { backgroundColor: 'rgba(52,199,89,0.04)' },
  sheetHeaderRight: { backgroundColor: 'rgba(255,69,58,0.04)' },
  sheetHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetHeaderInfoRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1, borderColor: 'rgba(52,199,89,0.2)',
    borderRadius: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#555555' },
  liveDotActive: { backgroundColor: '#34C759' },
  liveBadgeText: { color: '#555555', fontSize: 9, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },

  sheetName: { color: '#E5E5EA', fontSize: 13, fontWeight: '600' },
  sheetSub: { color: '#555555', fontSize: 10, fontFamily: 'monospace', marginTop: 1 },
  closeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  tabWrap: {
    position: 'absolute', top: '38%', zIndex: 50,
    width: TAB_W, height: TAB_H,
  },
  tabWrapLeft: { left: TAB_OFFSET },
  tabWrapRight: { right: TAB_OFFSET },

  tab: {
    width: TAB_W, height: TAB_H,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderRadius: TAB_H / 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  tabContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  tabLeft: {
    transform: [{ rotate: '-90deg' }],
    backgroundColor: '#0E1512',
    borderColor: 'rgba(52,199,89,0.22)',
  },
  tabRight: {
    transform: [{ rotate: '90deg' }],
    backgroundColor: '#15100F',
    borderColor: 'rgba(255,69,58,0.22)',
  },
  tabHoverLeft: {
    backgroundColor: '#111C16',
    borderColor: 'rgba(52,199,89,0.4)',
  },
  tabHoverRight: {
    backgroundColor: '#1C1211',
    borderColor: 'rgba(255,69,58,0.4)',
  },
  tabActiveLeft: {
    backgroundColor: '#0A1F13',
    borderColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  tabActiveRight: {
    backgroundColor: '#1F0E0C',
    borderColor: '#FF453A',
    shadowColor: '#FF453A',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  tabText: {
    fontSize: 11, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2,
  },
  tabTextLeft: { color: '#4CD964' },
  tabTextRight: { color: '#FF6961' },
  tabTextLeftActive: { color: '#B9FBC0' },
  tabTextRightActive: { color: '#FFC2BE' },

  pingWrap: {
    position: 'absolute', top: 8, right: 10,
    width: 8, height: 8, alignItems: 'center', justifyContent: 'center',
  },
  pingRing: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  pingCore: { width: 6, height: 6, borderRadius: 3 },
});
