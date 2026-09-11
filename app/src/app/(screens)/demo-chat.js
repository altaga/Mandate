import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldAlert, Terminal, Send, Server, Activity, Wallet } from 'lucide-react-native';
import { AgentService } from '../../services/agentService';
import { ArcService } from '../../services/arcService';
import { AGENT_NAME, getPreMandateReply } from '../../services/mandateChatPolicy';
import { useAgentTreasury } from '../../hooks/useAgentTreasury';
import { useInfraHealth } from '../../hooks/useInfraHealth';
import { TreasuryTab } from '../../features/mandate-control/TreasuryTab';
import { EdgePanels } from '../../features/mandate-control/EdgePanels';
import { InternalHealthTab } from '../../features/mandate-control/InternalHealthTab';
import { InfraStatusBar } from '../../features/mandate-control/InfraStatusBar';
import { useTrafficLab } from '../../hooks/useTrafficLab';

const INITIAL_MESSAGES = [
  { id: '1', role: 'system', text: 'SYSTEM ONLINE. I am Mandate-SRE-01.\n\nGrant native USDC from the treasury wallet to authorize my spend cap.' }
];

export default function DemoChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const { treasury, budget, unallocated, status: treasuryStatus, error: treasuryError, address, agentAddress, lastRefresh, refresh, confirmGrant, spend } = useAgentTreasury();
  const mandateFunded = budget > 0;
  const lab = useTrafficLab();
  const [activeTab, setActiveTab] = useState('chat');

  // ── Infra resilience callbacks ────────────────────────────────────────────
  const handleFailoverEvent = useCallback((event) => {
    if (!event) return;
    const lines = [
      `⚠ Layer 0 /${event.path} degraded — switching to ${event.sponsor || 'sponsor'}`,
      ...(event.logs || []).map((l) => `  ${l}`),
      event.txHash ? `  Tx: ${event.txHash}` : null,
      event.type === 'FAILOVER_BLOCKED'
        ? `❌ Failover blocked: ${event.reason}`
        : `🔵 ${event.sponsor} active on /${event.path}`,
    ].filter(Boolean);
    lines.forEach((text, i) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: `infra-fail-${Date.now()}-${i}`,
          role: 'system',
          text,
          type: event.type === 'FAILOVER_BLOCKED' ? 'error'
              : i === 0 ? 'warning'
              : text.startsWith('  Tx:') ? 'hash'
              : text.startsWith('💸') ? 'payment'
              : text.startsWith('🔵') ? 'success'
              : 'agent',
        }]);
      }, i * 180);
    });
    // A real tx just landed — re-pull the actual on-chain agent balance instead
    // of waiting for a manual Treasury tab click, so the deduction is visible
    // as soon as it's confirmed, not just tracked in local client state.
    if (event.txHash) {
      setTimeout(() => { refresh(); }, lines.length * 180 + 400);
    }
  }, [refresh]);

  const handleRecoveryEvent = useCallback((event) => {
    if (!event) return;
    const lines = [
      `✓ Layer 0 /${event.path} recovered — returning to own server`,
      event.reply,
    ].filter(Boolean);
    lines.forEach((text, i) => {
      setTimeout(() => {
        setMessages((prev) => [...prev, {
          id: `infra-rec-${Date.now()}-${i}`,
          role: 'system',
          text,
          type: 'success',
        }]);
      }, i * 180);
    });
  }, []);

  const infraHealth = useInfraHealth({
    budget,
    onSpend: spend,
    onFailoverEvent: handleFailoverEvent,
    onRecoveryEvent: handleRecoveryEvent,
  });
  const scrollViewRef = useRef(null);

  const envRef = useRef({
    budget: 0,
    onSpend: (amt) => spend(amt),
  });

  useEffect(() => { envRef.current.budget = budget; }, [budget]);
  useEffect(() => { envRef.current.onSpend = spend; }, [spend]);

  const addLog = (entry) => {
    setMessages(prev => [...prev, { 
      id: `log-${Date.now()}-${Math.random()}`, 
      role: 'system', 
      text: entry.text,
      type: entry.type 
    }]);
  };

  const agentCallbacks = () => ({ addLog });

  const handleAllocateFromTreasury = async (amount) => {
    if (treasuryStatus === 'loading') {
      return { ok: false, error: 'Treasury is still loading from Arc Testnet RPC.' };
    }
    if (treasuryStatus === 'error') {
      return { ok: false, error: treasuryError || 'Cannot read live treasury from Arc RPC.' };
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: 'Enter an amount greater than $0.00 USDC.' };
    }
    if (n > treasury) {
      return { ok: false, error: `Only $${treasury.toFixed(2)} USDC remains in the live treasury.` };
    }

    try {
      const mined = await ArcService.grantFromTreasury(n);
      confirmGrant(n);
      envRef.current.budget = Number(((envRef.current.budget || 0) + n).toFixed(4));
      addLog({ text: `Tx: ${mined.txHash}`, type: 'hash' });
      await refresh();
      return { ok: true, amount: n, txHash: mined.txHash };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  };

  const handleSendInput = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    setMessages(prev => [...prev, { id: `msg-user-${Date.now()}`, role: 'user', text }]);

    if (treasuryStatus === 'loading') {
      addLog({ text: `${AGENT_NAME}: Treasury is still loading from Arc Testnet RPC.` });
      return;
    }
    if (treasuryStatus === 'error') {
      addLog({
        text: `${AGENT_NAME}: Cannot read live treasury (${treasuryError || 'Arc RPC error'}).`,
        type: 'error'
      });
      return;
    }

    const { intent, reply, grant: grantResult } = getPreMandateReply(text, { treasury: unallocated });
    if (intent === 'AUTHORIZE') {
      if (!grantResult.ok) {
        addLog({ text: grantResult.error, type: 'error' });
        return;
      }
      const applied = await handleAllocateFromTreasury(grantResult.amount);
      if (!applied.ok) addLog({ text: applied.error, type: 'error' });
      return;
    }

    if (!mandateFunded) {
      addLog({ text: reply });
      return;
    }

    const history = messages
      .filter((m) => m.role === 'user' || (m.role === 'system' && m.type === 'agent'))
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.role === 'user' ? m.text : m.text.replace(`${AGENT_NAME}: `, ''),
      }))
      .slice(-20);

    AgentService.processAdminCommand(agentCallbacks(), envRef.current, text, history);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <EdgePanels lab={lab}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#8E8E93" />
        </Pressable>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Mandate Agent</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, mandateFunded && styles.statusDotActive]} />
            <Text style={[styles.statusText, mandateFunded && styles.statusTextActive]}>
              {mandateFunded ? 'MANDATE FUNDED' : 'READY'}
            </Text>
          </View>
        </View>
        <View style={styles.budgetBox}>
          <Text style={styles.budgetLabel}>TREASURY · ARC</Text>
          <Text style={[
            styles.budgetValue,
            (treasuryStatus === 'error' || (treasuryStatus !== 'loading' && treasury < 0.30)) && { color: '#FF453A' }
          ]}>
            {treasuryStatus === 'loading' ? '...' : treasuryStatus === 'error' ? 'ERR' : `$${treasury.toFixed(2)}`}
          </Text>
        </View>
      </View>

      <View style={styles.guardrailBanner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <ShieldAlert size={14} color="#8E8E93" style={{ marginRight: 6 }} />
          <Text style={[styles.guardrailText, { fontWeight: '700' }]}>
            {mandateFunded ? 'ACTIVE CRYPTOGRAPHIC MANDATE' : 'PENDING CRYPTOGRAPHIC MANDATE'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8E8E93', fontSize: 10, marginBottom: 2 }}>Authorized Budget</Text>
            <Text style={{ color: !mandateFunded ? '#8E8E93' : (budget < 0.30 ? '#FF453A' : '#34C759'), fontWeight: 'bold', fontSize: 13 }}>
              {mandateFunded ? `$${budget.toFixed(6)} USDC` : '$0.00 — grant from treasury'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8E8E93', fontSize: 10, marginBottom: 2 }}>Permitted Action</Text>
            <Text style={{ color: '#E5E5EA', fontWeight: 'bold', fontSize: 13 }}>Infrastructure Scaling</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#8E8E93', fontSize: 10, marginBottom: 2 }}>SLA Recourse</Text>
            <Text style={{ color: '#E5E5EA', fontWeight: 'bold', fontSize: 13 }}>{'On-Chain Refund (<2000ms)'}</Text>
          </View>
        </View>
      </View>

      <InfraStatusBar
        services={infraHealth.services}
        totalSponsorCost={infraHealth.totalSponsorCost}
        overallStatus={infraHealth.overallStatus}
      />

      <View style={styles.tabBar}>
        <Pressable 
          style={[styles.tabItem, activeTab === 'internal' && styles.tabItemActive]}
          onPress={() => setActiveTab('internal')}
        >
          <Activity size={16} color={activeTab === 'internal' ? '#FFFFFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'internal' && styles.tabTextActive]}>Internal Services</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabItem, activeTab === 'external' && styles.tabItemActive]}
          onPress={() => setActiveTab('external')}
        >
          <Server size={16} color={activeTab === 'external' ? '#FFFFFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'external' && styles.tabTextActive]}>External Services</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabItem, activeTab === 'treasury' && styles.tabItemActive]}
          onPress={() => { setActiveTab('treasury'); refresh(); }}
        >
          <Wallet size={16} color={activeTab === 'treasury' ? '#FFFFFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'treasury' && styles.tabTextActive]}>Treasury</Text>
        </Pressable>
        <Pressable 
          style={[styles.tabItem, activeTab === 'chat' && styles.tabItemActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Terminal size={16} color={activeTab === 'chat' ? '#FFFFFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Agent Chat</Text>
        </Pressable>
      </View>

      <View style={styles.mainSplit}>
        {activeTab === 'internal' && (
          <InternalHealthTab
            treasury={treasury}
            budget={budget}
            unallocated={unallocated}
            treasuryStatus={treasuryStatus}
            mandateFunded={mandateFunded}
            stats={lab.stats}
            running={lab.running}
          />
        )}

        {activeTab === 'external' && (
          <ScrollView style={styles.tabContent}>
            <View style={styles.tabHeader}>
              <Text style={styles.tabTitle}>INFRASTRUCTURE SERVICES</Text>
              <Text style={styles.tabSubtitle}>
                Layer 0 (own server) + Sponsor fallbacks — live state
              </Text>
            </View>

            {/* Layer 0 health */}
            <Text style={styles.sectionHeading}>LAYER 0 — OWN SERVER</Text>
            <View style={styles.vendorList}>
              {['health','balances','reputation','catalog','reason','probe'].map((path) => {
                const svc = infraHealth.services.find((s) => s.path === path);
                const isActive = svc?.mode === 'layer0' && svc?.severity === 'ok';
                const isSponsor = svc?.mode === 'sponsor';
                const isRecovering = svc?.mode === 'recovering';
                const isDegraded = !isSponsor && !isRecovering && svc?.severity === 'critical';
                const labels = { health: 'Health Probe', balances: 'Balance Checker', reputation: 'Vendor Reputation', catalog: 'Vendor Catalog', reason: 'LLM Reasoning', probe: 'Network Probe' };
                const badge = isSponsor ? styles.vendorBadgeSponsor
                            : isRecovering ? styles.vendorBadgeRecovering
                            : isDegraded ? styles.vendorBadgeDegraded
                            : isActive ? styles.vendorBadgeActive
                            : styles.vendorBadgeStandby;
                const badgeText = isSponsor ? styles.vendorBadgeTextSponsor
                                : isRecovering ? styles.vendorBadgeTextRecovering
                                : isDegraded ? styles.vendorBadgeTextDegraded
                                : isActive ? styles.vendorBadgeTextActive
                                : styles.vendorBadgeTextStandby;
                const status = isSponsor ? 'SPONSOR'
                             : isRecovering ? `RECOVERING ${svc.recoveryProbes}/${svc.recoveryNeeded}`
                             : isDegraded ? 'DEGRADED'
                             : isActive ? 'HEALTHY' : 'LOADING';
                return (
                  <View key={path} style={styles.vendorCard}>
                    <View style={styles.vendorHeader}>
                      <Text style={styles.vendorName}>{labels[path]}</Text>
                      <View style={badge}><Text style={badgeText}>{status}</Text></View>
                    </View>
                    <Text style={styles.vendorCost}>/api/{path === 'balances' ? 'treasury/balances' : path === 'reason' ? 'agent/reason' : path === 'probe' ? 'traffic/probe' : `vendor/${path}`}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      <Text style={styles.vendorDesc}>err {((svc?.errorRate || 0) * 100).toFixed(0)}%</Text>
                      <Text style={styles.vendorDesc}>{svc?.avgLatencyMs || 0}ms</Text>
                      {(isSponsor || isRecovering) && <Text style={[styles.vendorDesc, { color: '#5090D0' }]}>→ {svc.sponsor}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Active Sponsor Fallbacks (includes services mid-recovery) */}
            {infraHealth.services.some((s) => s.mode === 'sponsor' || s.mode === 'recovering') && (
              <>
                <Text style={styles.sectionHeading}>ACTIVE SPONSOR FALLBACKS</Text>
                <View style={styles.vendorList}>
                  {infraHealth.services.filter((s) => s.mode === 'sponsor' || s.mode === 'recovering').map((svc) => {
                    const recovering = svc.mode === 'recovering';
                    return (
                      <View key={svc.path} style={[styles.vendorCard, { borderColor: recovering ? 'rgba(255,214,10,0.3)' : 'rgba(80,144,208,0.3)' }]}>
                        <View style={styles.vendorHeader}>
                          <Text style={styles.vendorName}>{svc.sponsor}</Text>
                          <View style={recovering ? styles.vendorBadgeRecovering : styles.vendorBadgeSponsor}>
                            <Text style={recovering ? styles.vendorBadgeTextRecovering : styles.vendorBadgeTextSponsor}>
                              {recovering ? `RECOVERING ${svc.recoveryProbes}/${svc.recoveryNeeded}` : 'ACTIVE'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.vendorCost}>Handling: /{svc.path} — ${svc.sponsorCost} USDC/call</Text>
                        <Text style={styles.vendorDesc}>
                          {recovering
                            ? `Layer 0 responding again — confirming ${svc.recoveryProbes}/${svc.recoveryNeeded} clean probes before returning`
                            : 'Autonomous failover — Layer 0 degraded'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Sponsor catalog */}
            <Text style={styles.sectionHeading}>SPONSOR CATALOG (STANDBY)</Text>
            <View style={styles.vendorList}>
              {[
                { name: 'The Graph Oracle', cost: '$0.00004 / query', desc: 'Vendor reputation + liveness (real GRAPH_API_KEY, live queries)', rep: 98.9 },
                { name: 'Arc Direct RPC', cost: 'Free', desc: 'Balance reads bypassing Expo server (eth_getBalance via ARC_RPC_URL)', rep: 99.8 },
                { name: 'MiniMax Reasoning', cost: '$0.0008 / call', desc: 'Primary LLM reasoning engine (MINIMAX_API_KEY)', rep: 99.1 },
                { name: 'CloudBurst AI Edge', cost: '$0.0008 / incident', desc: 'AI ingress load-balancing for traffic spikes', rep: 99.1 },
                { name: 'MegaCompute Cluster', cost: '$0.0021 / incident', desc: 'High-throughput fallback compute cluster', rep: 98.7 },
                { name: 'Arc ERC-4337 Bundler', cost: '$0.0004 / relay', desc: 'Gasless UserOp relay to Arc EntryPoint', rep: 99.8 },
                { name: 'ResilientDB Recovery', cost: '$1.20 / incident', desc: 'Multi-region disaster recovery (requires human escalation)', rep: 99.9 },
              ].map((v) => (
                <View key={v.name} style={styles.vendorCard}>
                  <View style={styles.vendorHeader}>
                    <Text style={styles.vendorName}>{v.name}</Text>
                    <View style={styles.vendorBadgeStandby}><Text style={styles.vendorBadgeTextStandby}>STANDBY</Text></View>
                  </View>
                  <Text style={styles.vendorCost}>{v.cost} · Rep {v.rep}%</Text>
                  <Text style={styles.vendorDesc}>{v.desc}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {activeTab === 'treasury' && (
          <TreasuryTab
            address={address}
            agentAddress={agentAddress}
            treasury={treasury}
            budget={budget}
            unallocated={unallocated}
            status={treasuryStatus}
            error={treasuryError}
            lastRefresh={lastRefresh}
            onRefresh={refresh}
            onAllocate={handleAllocateFromTreasury}
            mandateActive={mandateFunded}
          />
        )}

        {activeTab === 'chat' && (
          <View style={[{ flex: 1, width: '100%' }]}>
            <ScrollView 
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.chatScroll} 
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map(msg => (
                <View key={msg.id} style={[
                  styles.messageWrapper,
                  msg.role === 'user' ? styles.messageUser : styles.messageSystem
                ]}>
                  <View style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleSystem,
                    (msg.type === 'error' || msg.type === 'escalation' || msg.type === 'inject') && { borderColor: 'rgba(255, 69, 58, 0.4)', backgroundColor: 'rgba(255, 69, 58, 0.05)' },
                    (msg.type === 'success' || msg.type === 'payment' || msg.type === 'decision' || msg.type === 'refund') && { borderColor: 'rgba(52, 199, 89, 0.4)', backgroundColor: 'rgba(52, 199, 89, 0.05)' }
                  ]}>
                    <Text style={[
                      styles.messageText,
                      msg.role === 'user' ? styles.messageTextUser : styles.messageTextSystem,
                      (msg.type === 'error' || msg.type === 'escalation' || msg.type === 'inject') && { color: '#FF453A' },
                      msg.type === 'warning' && { color: '#FFD60A' },
                      (msg.type === 'success' || msg.type === 'decision') && { color: '#34C759' },
                      (msg.type === 'payment' || msg.type === 'refund' || msg.type === 'hash') && { color: '#5090D0' },
                      msg.type === 'agent' && { color: '#CBD5E1' },
                      msg.type === 'code' && { color: '#8E8E93' },
                    ]}>
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}

            </ScrollView>
            
            <View style={styles.chatInputArea}>
              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  placeholder={mandateFunded ? `Instruct ${AGENT_NAME}, or say 'allow $2 from treasury'...` : "Ask about capabilities, or say 'allow $1 from treasury'..."}
                  placeholderTextColor="#8E8E93"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={handleSendInput}
                  returnKeyType="send"
                />
                <Pressable style={styles.chatSendBtn} onPress={handleSendInput}>
                  <Send size={16} color="#000000" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
      </EdgePanels>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 8 },
  headerTitleBox: { alignItems: 'center', gap: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E8E93' },
  statusDotActive: { backgroundColor: '#34C759' },
  statusText: { color: '#8E8E93', fontSize: 10, fontFamily: 'monospace' },
  statusTextActive: { color: '#34C759' },
  budgetBox: { alignItems: 'flex-end' },
  budgetLabel: { color: '#8E8E93', fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 },
  budgetValue: { color: '#FFFFFF', fontSize: 16, fontFamily: 'monospace', fontWeight: '700' },
  guardrailBanner: {
    backgroundColor: '#1C1C1E',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333'
  },
  guardrailText: { color: '#8E8E93', fontSize: 12, letterSpacing: 0.5 },
  mainSplit: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: '#050505' },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)' },
  tabText: { color: '#8E8E93', fontSize: 11, fontWeight: '600', fontFamily: 'monospace' },
  tabTextActive: { color: '#FFFFFF' },
  tabContent: { flex: 1, backgroundColor: '#000000', padding: 24 },
  tabHeader: { marginBottom: 32 },
  tabTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  tabSubtitle: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: '#0A0A0A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  metricLabel: { color: '#8E8E93', fontSize: 11, fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 },
  metricValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', marginBottom: 12 },
  metricStatus: { color: '#34C759', fontSize: 11, fontFamily: 'monospace', fontWeight: '600' },
  
  vendorList: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  vendorCard: { flex: 1, minWidth: '45%', backgroundColor: '#0A0A0A', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  
  chatScroll: { padding: 32, gap: 24, paddingBottom: 64, maxWidth: 800, alignSelf: 'center', width: '100%' },
  messageWrapper: { flexDirection: 'row', width: '100%', justifyContent: 'flex-start' },
  messageSystem: { },
  messageUser: { },
  bubble: { maxWidth: '100%', paddingHorizontal: 0, paddingVertical: 8 },
  bubbleSystem: { backgroundColor: 'transparent', borderColor: 'transparent' },
  bubbleUser: { backgroundColor: 'transparent', borderColor: 'transparent' },
  messageText: { fontSize: 14, lineHeight: 22 },
  messageTextUser: { color: '#8E8E93', fontWeight: '500' },
  messageTextSystem: { color: '#E2E8F0', fontFamily: 'monospace' },
  
  chatInputArea: { padding: 16, backgroundColor: '#050505', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  chatInputContainer: { flexDirection: 'row', alignItems: 'center', maxWidth: 800, width: '100%', alignSelf: 'center' },
  chatInput: { flex: 1, color: '#FFFFFF', fontSize: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#121212', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontFamily: 'monospace' },
  chatSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  
  vendorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  vendorName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  vendorBadgeActive: { backgroundColor: 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(52, 199, 89, 0.3)' },
  vendorBadgeTextActive: { color: '#34C759', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  vendorBadgeStandby: { backgroundColor: 'rgba(142, 142, 147, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(142, 142, 147, 0.3)' },
  vendorBadgeTextStandby: { color: '#8E8E93', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  vendorBadgeSponsor: { backgroundColor: 'rgba(80,144,208,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(80,144,208,0.4)' },
  vendorBadgeTextSponsor: { color: '#5090D0', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  vendorBadgeDegraded: { backgroundColor: 'rgba(255,69,58,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)' },
  vendorBadgeTextDegraded: { color: '#FF453A', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  vendorBadgeRecovering: { backgroundColor: 'rgba(255,214,10,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,214,10,0.4)' },
  vendorBadgeTextRecovering: { color: '#FFD60A', fontSize: 10, fontWeight: '700', fontFamily: 'monospace' },
  vendorCost: { color: '#A1A1AA', fontSize: 13, fontFamily: 'monospace', marginBottom: 4 },
  vendorDesc: { color: '#6B7280', fontSize: 13 },
  sectionHeading: { color: '#8E8E93', fontSize: 11, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1.5, marginTop: 24, marginBottom: 12 },
  
});
