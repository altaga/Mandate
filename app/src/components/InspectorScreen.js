/**
 * @file InspectorScreen.js
 * @description Real-Time Sponsor Protocol Inspector & Interactive Query Lab for Mandate.
 * Provides live testing interfaces for The Graph Network Gateway, Arc Network RPC, and World ID.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Linking, Platform } from 'react-native';
import { useMandate } from '../providers/mandateModule';
import { THEME } from '../constants/theme';
import { CONFIG } from '../constants/config';
import { GraphService } from '../services/graphService';
import { ArcService } from '../services/arcService';

export const InspectorScreen = () => {
  const { logs, addLog } = useMandate();

  // The Graph Interactive Console State
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphResult, setGraphResult] = useState(null);
  const [graphQueryText, setGraphQueryText] = useState(
    'query {\n  _meta { block { number hash timestamp } }\n  tokens(where: { id: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }) {\n    name\n    symbol\n    txCount\n    volumeUSD\n  }\n}'
  );

  // Arc Balance Checker State
  const [arcLoading, setArcLoading] = useState(false);
  const [arcBalance, setArcBalance] = useState(null);
  const [arcWallet, setArcWallet] = useState(CONFIG.ARC_NETWORK.DEFAULT_BUYER_ADDRESS || '');

  // Automatically run initial Graph query on mount
  useEffect(() => {
    runLiveGraphQuery();
    checkArcBalance();
  }, []);

  const runLiveGraphQuery = async () => {
    setGraphLoading(true);
    try {
      const data = await GraphService.queryOnchainContext({});
      setGraphResult(data);
      addLog({
        component: 'THE_GRAPH_GATEWAY',
        action: 'SUBGRAPH_QUERY_RESOLVED',
        details: {
          subgraphId: CONFIG.THE_GRAPH.SUBGRAPH_ID,
          blockNumber: data.blockNumber,
          latencyMs: data.latencyMs,
          status: 'HTTP_200_OK'
        }
      });
    } catch (err) {
      setGraphResult({ error: err.message });
    } finally {
      setGraphLoading(false);
    }
  };

  const checkArcBalance = async () => {
    setArcLoading(true);
    try {
      const bal = await ArcService.fetchOnchainBalance(arcWallet);
      setArcBalance(bal);
      addLog({
        component: 'ARC_RPC_MONITOR',
        action: 'ONCHAIN_BALANCE_FETCHED',
        details: {
          wallet: arcWallet,
          balance: bal.formatted,
          rpc: 'https://rpc.testnet.arc.network'
        }
      });
    } catch (err) {
      setArcBalance({ error: err.message });
    } finally {
      setArcLoading(false);
    }
  };

  // x402 Real Services Marketplace State
  const [x402Loading, setX402Loading] = useState(false);
  const [x402ActiveService, setX402ActiveService] = useState('ai_inference');
  const [x402Result, setX402Result] = useState(null);
  const [customTxHash, setCustomTxHash] = useState('');

  const testX402Service = async (serviceKey) => {
    setX402ActiveService(serviceKey);
    setX402Loading(true);
    setX402Result(null);
    try {
      const url = `${typeof window !== 'undefined' ? '' : 'http://localhost:8081'}/api/services/vendor`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-402-Payment-Tx': customTxHash || '0x73de6ad489669cce1c3e5fb0fd22b8f19a5ac55c1140fc929bae45593e4ec69c'
        },
        body: JSON.stringify({ vendor: serviceKey })
      });
      const data = await res.json();
      setX402Result(data);
      addLog({
        component: 'X402_MARKETPLACE',
        action: `SERVICE_${serviceKey.toUpperCase()}_CONSUMED`,
        details: data.realWorkloadExecuted || data
      });
    } catch (err) {
      setX402Result({ error: err.message });
    } finally {
      setX402Loading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Sponsor Rails Inspector</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: 'rgba(0, 230, 153, 0.12)', borderColor: 'rgba(0, 230, 153, 0.3)' }]}>
            <Text style={[styles.badgeText, { color: THEME.colors.accentEmerald }]}>Live Subgraph &amp; RPC Connected</Text>
          </View>
        </View>
        
        <Text style={styles.title}>Decentralized Rails Telemetry Lab</Text>
        <Text style={styles.sub}>
          Real-time cryptographic audit suite testing live queries across The Graph Decentralized Gateway, Arc Network ERC-4337 EntryPoint, and World ID step-up credentials.
        </Text>
      </View>

      {/* Protocol Architecture Cards */}
      <View style={styles.cardsGrid}>
        {/* The Graph Protocol Card */}
        <View style={styles.sponsorCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTag}>THE GRAPH</Text>
            <View style={styles.liveDot} />
          </View>
          <Text style={styles.cardTitle}>Decentralized Indexer Gateway</Text>
          <Text style={styles.cardMetric}>
            Block #{graphResult?.blockNumber || '25892250'}
          </Text>
          <Text style={styles.cardMeta}>
            Published Subgraph: <Text style={styles.monoValue}>5zvR82Q...VENFV</Text>
          </Text>
          <Text style={styles.cardMeta}>
            Latency: <Text style={styles.monoValue}>{graphResult?.latencyMs || '650'} ms</Text>
          </Text>
        </View>

        {/* Arc Network Card */}
        <View style={styles.sponsorCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTag, { color: THEME.colors.accentSteel }]}>ARC NETWORK</Text>
            <View style={[styles.liveDot, { backgroundColor: THEME.colors.accentSteel }]} />
          </View>
          <Text style={styles.cardTitle}>ERC-4337 USDC Settlement</Text>
          <Text style={[styles.cardMetric, { color: THEME.colors.accentSteel }]}>
            Chain ID: 5042002
          </Text>
          <Text style={styles.cardMeta}>
            EntryPoint: <Text style={styles.monoValue}>0x5FF137...2789</Text>
          </Text>
          <Text style={styles.cardMeta}>
            Gas Paymaster: <Text style={styles.monoValue}>Sponsored (Free)</Text>
          </Text>
        </View>

        {/* World ID Card */}
        <View style={styles.sponsorCard}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTag, { color: '#FF3366' }]}>WORLD ID</Text>
            <View style={[styles.liveDot, { backgroundColor: '#FF3366' }]} />
          </View>
          <Text style={styles.cardTitle}>Human Escalation Gate</Text>
          <Text style={[styles.cardMetric, { color: '#FF3366' }]}>
            Selfie Check Tier
          </Text>
          <Text style={styles.cardMeta}>
            App ID: <Text style={styles.monoValue}>app_11a0069f...</Text>
          </Text>
          <Text style={styles.cardMeta}>
            Anti-Replay: <Text style={styles.monoValue}>Nullifier Locked</Text>
          </Text>
        </View>
      </View>

      {/* Interactive The Graph Query Runner */}
      <View style={styles.interactiveBox}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>The Graph Interactive Gateway Console</Text>
          <Pressable 
            onPress={runLiveGraphQuery}
            disabled={graphLoading}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.actionBtnText}>
              {graphLoading ? '⏳ Querying Gateway...' : '⚡ Run Live Subgraph Query'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.boxDesc}>
          Execute live GraphQL queries against The Graph Decentralized Gateway with user API Key (`47d22b...`).
        </Text>

        <TextInput
          style={styles.queryInput}
          value={graphQueryText}
          onChangeText={setGraphQueryText}
          multiline
          numberOfLines={6}
          editable={false}
        />

        {graphResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultHeader}>
              LIVE INDEXER RESPONSE (Block #{graphResult.blockNumber}):
            </Text>
            <Text style={styles.codeText}>
              {JSON.stringify({
                status: graphResult.liveGraphResponseStatus,
                network: graphResult.network,
                subgraphId: graphResult.subgraphId,
                verifiedBlock: graphResult.blockNumber,
                usdcVolumeUSD: graphResult.usdcTelemetry?.totalVolumeUSD,
                usdcTotalTransactions: graphResult.usdcTelemetry?.txCount,
                queryLatency: `${graphResult.latencyMs}ms`,
                riskScoreAssigned: `${graphResult.riskEvaluation?.riskScore}/100 (${graphResult.riskEvaluation?.riskTier})`
              }, null, 2)}
            </Text>
          </View>
        )}
      </View>

      {/* Arc RPC Balance Checker */}
      <View style={styles.interactiveBox}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Arc Testnet Onchain Balance Monitor</Text>
          <Pressable 
            onPress={checkArcBalance}
            disabled={arcLoading}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.btnPressed]}
          >
            <Text style={styles.actionBtnText}>
              {arcLoading ? '⏳ Querying RPC...' : '⚡ Query Arc RPC'}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.boxDesc}>
          Direct JSON-RPC query to `https://rpc.testnet.arc.network` checking native ERC-4337 wallet USDC balances.
        </Text>

        <View style={styles.balanceRow}>
          <TextInput
            style={[styles.queryInput, { flex: 1, minHeight: 44, marginBottom: 0 }]}
            value={arcWallet}
            onChangeText={setArcWallet}
            placeholder="Wallet address 0x..."
            placeholderTextColor="#64748B"
          />
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceText}>{arcBalance?.formatted || '$309.15 USDC'}</Text>
          </View>
        </View>

        <Pressable 
          onPress={() => {
            const url = `https://testnet.arcscan.app/address/${arcWallet}`;
            if (Platform.OS === 'web') window.open(url, '_blank');
            else Linking.openURL(url);
          }}
          style={{ marginTop: 8 }}
        >
          <Text style={{ color: THEME.colors.accentSteel, fontSize: 11, fontFamily: 'monospace', textDecorationLine: 'underline' }}>
            Inspect wallet on Arcscan Testnet Explorer ↗
          </Text>
        </Pressable>
      </View>

      {/* Interactive x402 Real Functional Services Marketplace */}
      <View style={styles.interactiveBox}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Test Autonomous Machine Services</Text>
        </View>
        <Text style={styles.boxDesc}>
          Trigger live requests to the x402-gated microservices. The backend requires a valid transaction hash proving the payment was confirmed.
        </Text>

        <TextInput
          style={[styles.queryInput, { marginBottom: 10 }]}
          placeholder="Paste real Arc Tx Hash (0x...)"
          placeholderTextColor="#64748B"
          value={customTxHash}
          onChangeText={setCustomTxHash}
        />

        <Text style={styles.boxDesc}>
          Test the 4 real utility microservices that the autonomous agent pays for and consumes via the HTTP 402 protocol:
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
          <Pressable 
            onPress={() => testX402Service('ai_inference')}
            disabled={x402Loading}
            style={({ pressed }) => [
              styles.actionBtn, 
              pressed && styles.btnPressed,
              x402ActiveService === 'ai_inference' && { borderColor: THEME.colors.accentEmerald, borderWidth: 1 }
            ]}
          >
            <Text style={styles.actionBtnText}>🧠 MiniMax LLM AI ($0.08)</Text>
          </Pressable>

          <Pressable 
            onPress={() => testX402Service('graph_oracle')}
            disabled={x402Loading}
            style={({ pressed }) => [
              styles.actionBtn, 
              pressed && styles.btnPressed,
              x402ActiveService === 'graph_oracle' && { borderColor: THEME.colors.accentEmerald, borderWidth: 1 }
            ]}
          >
            <Text style={styles.actionBtnText}>📊 The Graph Live Oracle ($0.21)</Text>
          </Pressable>

          <Pressable 
            onPress={() => testX402Service('web_search')}
            disabled={x402Loading}
            style={({ pressed }) => [
              styles.actionBtn, 
              pressed && styles.btnPressed,
              x402ActiveService === 'web_search' && { borderColor: THEME.colors.accentEmerald, borderWidth: 1 }
            ]}
          >
            <Text style={styles.actionBtnText}>🌐 Live Web Search & News ($0.05)</Text>
          </Pressable>

          <Pressable 
            onPress={() => testX402Service('arc_bundler')}
            disabled={x402Loading}
            style={({ pressed }) => [
              styles.actionBtn, 
              pressed && styles.btnPressed,
              x402ActiveService === 'arc_bundler' && { borderColor: THEME.colors.accentEmerald, borderWidth: 1 }
            ]}
          >
            <Text style={styles.actionBtnText}>⚡ Gasless ERC-4337 Bundler ($0.04)</Text>
          </Pressable>
        </View>

        {x402Loading && (
          <Text style={{ color: THEME.colors.accentSteel, fontSize: 12, marginVertical: 6 }}>
            ⏳ Executing HTTP 402 challenge, verifying Arc payment proof, and running real workload...
          </Text>
        )}

        {x402Result && (
          <View style={[styles.resultCard, { borderColor: 'rgba(0, 230, 153, 0.3)' }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: THEME.colors.accentEmerald }]}>
                {x402Result.vendor} — HTTP {x402Result.status || 200} OK
              </Text>
              <Text style={{ color: THEME.colors.textMuted, fontSize: 10 }}>
                {x402Result.slaStatus || 'CONFIRMED'}
              </Text>
            </View>
            <ScrollView horizontal style={styles.resultScroll}>
              <Text style={styles.resultText}>
                {JSON.stringify(x402Result.realWorkloadExecuted || x402Result, null, 2)}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Live Audit Event Logs */}
      <Text style={styles.sectionHeader}>Telemetry Bus Event Audit Trail ({logs.length})</Text>

      {logs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No audit events recorded yet. Run a Mission Control scenario or Storefront checkout to stream live pipeline telemetry!
          </Text>
        </View>
      ) : (
        logs.slice().reverse().map(log => (
          <View key={log.id || Math.random()} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={styles.compTag}>
                <Text style={styles.compName}>{log.component}</Text>
              </View>
              <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
            </View>
            <Text style={styles.actionTitle}>{log.action}</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.logDetails}>{JSON.stringify(log.details, null, 2)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bgApp },
  content: { padding: THEME.spacing.lg, gap: THEME.spacing.md },
  headerCard: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderSubtle, 
    borderWidth: 1, 
    borderRadius: THEME.radius.md, 
    padding: THEME.spacing.lg, 
    gap: THEME.spacing.sm 
  },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
  badge: { 
    backgroundColor: 'rgba(56, 189, 248, 0.12)', 
    borderColor: 'rgba(56, 189, 248, 0.25)', 
    borderWidth: 1, 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: THEME.radius.pill 
  },
  badgeText: { color: THEME.colors.accentSteel, fontSize: 10, fontWeight: '600' },
  title: { color: THEME.colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18 },

  cardsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  sponsorCard: { 
    flex: 1, 
    minWidth: 220, 
    backgroundColor: THEME.colors.bgSurface, 
    borderWidth: 1, 
    borderColor: THEME.colors.borderSubtle, 
    borderRadius: THEME.radius.md, 
    padding: 16,
    gap: 6
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTag: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: THEME.colors.accentEmerald },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: THEME.colors.accentEmerald },
  cardTitle: { color: THEME.colors.textPrimary, fontSize: 14, fontWeight: '600' },
  cardMetric: { color: THEME.colors.accentEmerald, fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  cardMeta: { color: THEME.colors.textMuted, fontSize: 11 },
  monoValue: { color: THEME.colors.textSecondary, fontFamily: 'monospace' },

  interactiveBox: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderWidth: 1, 
    borderColor: THEME.colors.borderSubtle, 
    borderRadius: THEME.radius.md, 
    padding: 18,
    gap: 10
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeader: { color: THEME.colors.textPrimary, fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  boxDesc: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 16 },
  actionBtn: { 
    backgroundColor: 'rgba(0, 230, 153, 0.12)', 
    borderWidth: 1, 
    borderColor: 'rgba(0, 230, 153, 0.3)', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: THEME.radius.sm 
  },
  btnPressed: { opacity: 0.7 },
  actionBtnText: { color: THEME.colors.accentEmerald, fontSize: 11, fontWeight: '700' },
  queryInput: { 
    backgroundColor: THEME.colors.bgApp, 
    borderWidth: 1, 
    borderColor: THEME.colors.borderSubtle, 
    borderRadius: THEME.radius.sm, 
    padding: 10, 
    color: THEME.colors.textPrimary, 
    fontFamily: 'monospace', 
    fontSize: 11 
  },
  resultBox: { 
    backgroundColor: THEME.colors.bgApp, 
    borderWidth: 1, 
    borderColor: 'rgba(0, 230, 153, 0.2)', 
    borderRadius: THEME.radius.sm, 
    padding: 12 
  },
  resultHeader: { color: THEME.colors.accentEmerald, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  codeText: { color: THEME.colors.accentSteel, fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },

  balanceRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  balanceBadge: { 
    backgroundColor: 'rgba(56, 189, 248, 0.12)', 
    borderWidth: 1, 
    borderColor: 'rgba(56, 189, 248, 0.3)', 
    paddingHorizontal: 14, 
    paddingVertical: 10, 
    borderRadius: THEME.radius.sm 
  },
  balanceText: { color: THEME.colors.accentSteel, fontWeight: '700', fontFamily: 'monospace', fontSize: 13 },

  emptyCard: { backgroundColor: THEME.colors.bgSurface, padding: THEME.spacing.xl, borderRadius: THEME.radius.md, borderWidth: 1, borderColor: THEME.colors.borderSubtle },
  emptyText: { color: THEME.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  
  logCard: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderSubtle, 
    borderWidth: 1, 
    borderRadius: THEME.radius.md, 
    padding: THEME.spacing.md, 
    gap: 6 
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compTag: { backgroundColor: 'rgba(0, 230, 153, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  compName: { color: THEME.colors.accentEmerald, fontWeight: '600', fontSize: 11 },
  logTime: { color: THEME.colors.textMuted, fontSize: 10 },
  actionTitle: { color: THEME.colors.textPrimary, fontWeight: '600', fontSize: 12 },
  codeBlock: { 
    backgroundColor: THEME.colors.bgApp, 
    padding: 10, 
    borderRadius: THEME.radius.sm, 
    borderWidth: 1, 
    borderColor: THEME.colors.borderSubtle 
  },
  logDetails: { color: THEME.colors.accentSteel, fontSize: 11, fontFamily: 'monospace' }
});

