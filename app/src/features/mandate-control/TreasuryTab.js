import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Linking } from 'react-native';
import { RefreshCw, Wallet } from 'lucide-react-native';
import { toast } from 'react-native-sonner';
import { CONFIG } from '../../constants/config';
import { ArcService } from '../../services/arcService';

const PRESETS = [1, 5, 10];

function formatUsd(n) {
  // 6 decimals so sub-cent sponsor payments are actually visible moving,
  // instead of every real deduction rounding invisibly back to the same $X.00.
  return `$${(Number(n) || 0).toFixed(6)}`;
}

function shortenAddress(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TreasuryTab({
  address,
  agentAddress,
  treasury,
  budget,
  unallocated,
  status,
  error,
  lastRefresh,
  onRefresh,
  onAllocate,
  mandateActive
}) {
  const [amount, setAmount] = useState('1.00');
  const [feedback, setFeedback] = useState(null);

  const submitAllocate = async () => {
    setFeedback({ type: 'info', text: 'Broadcasting native USDC grant…' });
    const result = await onAllocate(Number(amount));
    if (!result?.ok) {
      setFeedback({ type: 'error', text: result?.error || 'Allocation failed.' });
      return;
    }
    setFeedback({
      type: 'success',
      text: result.txHash ? `Tx: ${result.txHash}` : `Granted ${formatUsd(result.amount)} USDC.`
    });

    // The inline feedback line above is easy to miss (it's below the fold on
    // a real click) — a toast is the visible, unmissable confirmation that
    // this was a real on-chain transaction, not a local counter bump.
    if (result.txHash) {
      toast.success(`${formatUsd(result.amount)} USDC granted on-chain`, {
        description: `Tx: ${result.txHash.slice(0, 10)}…${result.txHash.slice(-8)}`,
        duration: 8000,
        action: {
          label: 'View on Arcscan ↗',
          onClick: () => Linking.openURL(ArcService.getExplorerTxUrl(result.txHash)),
        },
      });
    }
  };

  const openExplorer = () => {
    if (!address) return;
    const base = CONFIG.ARC_NETWORK.EXPLORER_URL.replace(/\/$/, '');
    Linking.openURL(`${base}/address/${address}`);
  };

  const openAgentExplorer = () => {
    if (!agentAddress) return;
    const base = CONFIG.ARC_NETWORK.EXPLORER_URL.replace(/\/$/, '');
    Linking.openURL(`${base}/address/${agentAddress}`);
  };

  return (
    <ScrollView style={styles.tabContent}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>LIVE TREASURY</Text>
        <Text style={styles.tabSubtitle}>Arc Testnet native USDC on the Mandate treasury wallet</Text>
      </View>

      <TreasuryStatus
        status={status}
        error={error}
        lastRefresh={lastRefresh}
        onRefresh={onRefresh}
      />

      <View style={styles.metricGrid}>
        <MetricCard label="ON-CHAIN VAULT" value={status === 'loading' ? '…' : formatUsd(treasury)} hint="Treasury wallet · Arc RPC" />
        <MetricCard label="ALLOCATED TO AGENT" value={status === 'loading' ? '…' : formatUsd(budget)} hint={mandateActive ? 'Agent wallet · live USDC' : 'Agent wallet is empty'} accent={mandateActive ? '#34C759' : '#8E8E93'} />
        <MetricCard label="UNALLOCATED" value={status === 'loading' ? '…' : formatUsd(unallocated)} hint="Still in treasury" />
        <Pressable style={styles.metricCard} onPress={openExplorer}>
          <Text style={styles.metricLabel}>TREASURY WALLET</Text>
          <Text style={styles.addressValue}>{shortenAddress(address)}</Text>
          <Text style={styles.metricStatus}>Open Arcscan ↗</Text>
        </Pressable>
        <Pressable style={styles.metricCard} onPress={openAgentExplorer}>
          <Text style={styles.metricLabel}>AGENT WALLET</Text>
          <Text style={styles.addressValue}>{shortenAddress(agentAddress)}</Text>
          <Text style={styles.metricStatus}>Open Arcscan ↗</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Wallet size={16} color="#FFFFFF" />
          <Text style={styles.panelTitle}>MANDATE CONTROL PANEL</Text>
        </View>
        <Text style={styles.panelCopy}>
          Authorize additional agent budget from treasury. Grants send native USDC to the agent wallet — that live balance is the Mandate.
        </Text>

        <View style={styles.presetRow}>
          {PRESETS.map((preset) => (
            <Pressable key={preset} style={styles.presetBtn} onPress={() => setAmount(preset.toFixed(2))}>
              <Text style={styles.presetText}>{formatUsd(preset)}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.presetBtn}
            // toFixed(2) rounds — for an unallocated balance like 0.9695 that
            // rounds UP to "0.97", which is then rejected by the treasury
            // guard as exceeding the real (unrounded) balance. Floor to 2
            // decimals so MAX always requests an amount the treasury
            // actually has, confirmed directly (0.969493 → "0.97" → grant
            // silently failed with "Only $0.97 USDC remains...").
            onPress={() => setAmount((Math.floor(unallocated * 100) / 100).toFixed(2))}
          >
            <Text style={styles.presetText}>MAX</Text>
          </Pressable>
        </View>

        <View style={styles.allocateRow}>
          <TextInput
            style={styles.amountInput}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            placeholder="1.00"
            placeholderTextColor="#8E8E93"
          />
          <Pressable
            style={[styles.allocateBtn, (status !== 'ready' && status !== 'empty') && styles.allocateBtnDisabled]}
            onPress={submitAllocate}
            disabled={status === 'loading' || status === 'error'}
          >
            <Text style={styles.allocateBtnText}>
              {mandateActive ? 'ADD TO AGENT BUDGET' : 'AUTHORIZE MANDATE'}
            </Text>
          </Pressable>
        </View>

        {feedback && (
          <Text style={[
            styles.feedback,
            feedback.type === 'error' ? styles.feedbackError : feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackInfo
          ]}>
            {feedback.text}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function TreasuryStatus({ status, error, lastRefresh, onRefresh }) {
  if (status === 'loading' && !lastRefresh) {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.stateText}>Reading live USDC from Arc Testnet RPC…</Text>
      </View>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateError}>Treasury RPC failed: {error}</Text>
        <Pressable style={styles.retryBtn} onPress={onRefresh}>
          <Text style={styles.retryText}>RETRY BALANCE FETCH</Text>
        </Pressable>
      </View>
    );
  }
  if (status === 'empty') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>On-chain vault is {formatUsd(0)}. Fund the treasury wallet before authorizing a Mandate.</Text>
      </View>
    );
  }
  return (
    <Pressable style={styles.refreshRow} onPress={onRefresh}>
      <RefreshCw size={12} color="#8E8E93" />
      <Text style={styles.refreshText}>
        Last RPC read {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : '—'} · tap to refresh
      </Text>
    </Pressable>
  );
}

function MetricCard({ label, value, hint, accent }) {
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
  tabHeader: { marginBottom: 20 },
  tabTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  tabSubtitle: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: '#0A0A0A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metricLabel: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 },
  metricValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginBottom: 12 },
  addressValue: { color: '#FFFFFF', fontSize: 16, fontFamily: 'monospace', marginBottom: 12 },
  metricStatus: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace' },
  stateBox: { padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 20, gap: 12, alignItems: 'flex-start' },
  stateText: { color: '#8E8E93', fontSize: 13, lineHeight: 20 },
  stateError: { color: '#FF453A', fontSize: 13, lineHeight: 20 },
  retryBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
  retryText: { color: '#000000', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  refreshText: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace' },
  panel: { backgroundColor: '#0A0A0A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  panelCopy: { color: '#8E8E93', fontSize: 13, lineHeight: 20 },
  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
  presetText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'monospace' },
  allocateRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 16, fontFamily: 'monospace', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#121212', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  allocateBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 4 },
  allocateBtnDisabled: { opacity: 0.4 },
  allocateBtnText: { color: '#000000', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  feedback: { fontSize: 13, lineHeight: 18 },
  feedbackError: { color: '#FF453A' },
  feedbackSuccess: { color: '#34C759' },
  feedbackInfo: { color: '#8E8E93' },
});
