/**
 * @file CheckoutModal.js
 * @description 4-Stage Biometric Checkout Overlay Modal for Mandate Expo Mobile App.
 * Orchestrates Biometric scan -> World Selfie Check -> The Graph Context -> Arc USDC Payment.
 */

import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useMandate } from '../providers/mandateModule';
import { BiometricService } from '../services/biometricService';
import { WorldService } from '../services/worldService';
import { GraphService } from '../services/graphService';
import { ArcService } from '../services/arcService';
import { THEME } from '../constants/theme';
import WebcamCapture from './WebcamCapture';
import { IDKitRequestWidget, passport } from '@worldcoin/idkit';

export const CheckoutModal = ({ visible, item, onClose }) => {
  const { currentUser, addLog } = useMandate();

  const [stage, setStage] = useState(1); // 1=Biometrics, 2=World ID, 3=Graph & Arc, 4=Receipt
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedToken, setSelectedToken] = useState('USDC');

  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);

  const webcamRef = React.useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const [biometricResult, setBiometricResult] = useState(null);
  const [worldResult, setWorldResult] = useState(null);
  const [graphResult, setGraphResult] = useState(null);
  const [receipt, setReceipt] = useState(null);

  if (!item) return null;

  // Stage 1: Execute Biometric Liveness Verification
  const handleBiometricPass = async () => {
    setLoading(true);
    setError(null);
    try {
      let base64 = null;
      if (webcamRef.current) {
        base64 = webcamRef.current.capture();
        setCapturedImage(base64);
      }
      
      addLog({ component: 'BIOMETRIC_ENGINE_128D', action: 'BIOMETRIC_SCAN_START', details: { userId: currentUser.id } });
      const bioData = await BiometricService.verifyBiometrics({
        userId: currentUser.id,
        expectedWallet: currentUser.walletAddress,
        imageBase64: base64
      });

      if (bioData.success) {
        setBiometricResult(bioData);
        addLog({ component: 'BIOMETRIC_ENGINE_128D', action: 'BIOMETRIC_MATCH_SUCCESS', details: bioData });
        setStage(2); // Advance to World Selfie Check
      } else {
        setError('Biometric liveness or face match verification failed');
      }
    } catch (err) {
      setError(err.message || 'Error processing face biometrics');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Execute World Selfie Check Step-Up
  const handleWorldProofPass = async (proofPayload) => {
    setLoading(true);
    setError(null);
    try {
      addLog({ component: 'WORLD_ID_SERVICE', action: 'WORLD_PROOF_VERIFY_START', details: { action: 'mandate-operator-auth' } });
      const worldData = await WorldService.verifyWorldProof({ proofPayload });

      if (worldData.success) {
        setWorldResult(worldData);
        addLog({ component: 'WORLD_ID_SERVICE', action: 'WORLD_PROOF_VERIFY_SUCCESS', details: worldData });
        setStage(3);
        executePipeline(worldData.nullifier_hash);
      } else {
        setError(worldData.error || 'World ID proof validation failed');
      }
    } catch (err) {
      setError(err.message || 'World ID verification error');
    } finally {
      setLoading(false);
    }
  };

  const openRealWorldID = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sign');
      if (!res.ok) throw new Error('Failed to fetch World ID signature context');
      const data = await res.json();
      if (data.signature) {
        setRpContext(data);
        setIdkitOpen(true);
      }
    } catch (err) {
      setError('Could not connect to World Developer API for Context');
    } finally {
      setLoading(false);
    }
  };

  // Stage 3 & 4: Query The Graph & Settle on Arc USDC Rail
  const executePipeline = async (nullifierHash) => {
    setLoading(true);
    try {
      // 1. Query Graph
      addLog({ component: 'THE_GRAPH_INDEXER', action: 'SUBGRAPH_QUERY_START', details: { wallet: currentUser.walletAddress } });
      const gData = await GraphService.queryOnchainContext({ walletAddress: currentUser.walletAddress });
      setGraphResult(gData);
      addLog({ component: 'THE_GRAPH_INDEXER', action: 'SUBGRAPH_QUERY_SUCCESS', details: gData });

      // 2. Execute Arc Payment
      addLog({ component: 'ARC_PAYMENT_RAIL', action: 'TRANSACTION_BROADCAST', details: { amountUsdc: item.priceUsdc } });
      const payReceipt = await ArcService.executePayment({
        userId: currentUser.id,
        walletAddress: currentUser.walletAddress,
        amountUsdc: item.priceUsdc,
        currency: selectedToken,
        itemDescription: item.name,
        worldNullifierHash: nullifierHash,
        graphRiskScore: gData.riskEvaluation.riskScore
      });

      setReceipt(payReceipt);
      addLog({ component: 'ARC_PAYMENT_RAIL', action: 'TRANSACTION_FINALIZED', details: payReceipt });
      setStage(4); // Advance to Receipt
    } catch (err) {
      setError(err.message || 'Pipeline execution error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalCategoryBadge}>
                <Text style={styles.modalCategoryText}>Mandate Biometric Checkout</Text>
              </View>
              <Text style={styles.title}>{item.name}</Text>
            </View>
            <Pressable 
              onPress={onClose} 
              style={({ pressed }) => [styles.closeBtn, pressed && styles.btnPressed]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={{ color: THEME.colors.textSecondary, fontWeight: '600', fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          {/* Pipeline Step Indicators */}
          <View style={styles.pipelineBar}>
            <View style={[styles.pipeStepBox, stage >= 1 && styles.pipeActiveBox]}>
              <Text style={[styles.pipeStepText, stage >= 1 && styles.pipeActiveText]}>1. Face bio</Text>
            </View>
            <View style={[styles.pipeStepBox, stage >= 2 && styles.pipeActiveBox]}>
              <Text style={[styles.pipeStepText, stage >= 2 && styles.pipeActiveText]}>2. World ID</Text>
            </View>
            <View style={[styles.pipeStepBox, stage >= 3 && styles.pipeActiveBox]}>
              <Text style={[styles.pipeStepText, stage >= 3 && styles.pipeActiveText]}>3. Graph</Text>
            </View>
            <View style={[styles.pipeStepBox, stage >= 4 && styles.pipeActiveBox]}>
              <Text style={[styles.pipeStepText, stage >= 4 && styles.pipeActiveText]}>4. Arc Settlement</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
            {/* STAGE 1: Biometrics */}
            {stage === 1 && (
              <View style={styles.stageCard}>
                
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: THEME.colors.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' }}>Select Payment Currency</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    {['USDC', 'EURC', 'cirBTC'].map((token) => (
                      <Pressable 
                        key={token}
                        onPress={() => setSelectedToken(token)}
                        style={[
                          styles.tokenBtn,
                          selectedToken === token && styles.tokenBtnActive
                        ]}
                      >
                        <Text style={[styles.tokenBtnText, selectedToken === token && styles.tokenBtnTextActive]}>{token}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.cameraBox}>
                  {Platform.OS === 'web' ? (
                    <WebcamCapture ref={webcamRef} width={280} height={180} style={{ borderRadius: THEME.radius.md }} />
                  ) : (
                    <View style={styles.reticle} />
                  )}
                  <Text style={styles.camLabel}>Open-Source 128d Biometric Vector Liveness Scan</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Enrolled Profile</Text>
                  <Text style={styles.infoVal}>{currentUser.name}</Text>
                </View>

                <Pressable 
                  onPress={handleBiometricPass} 
                  disabled={loading} 
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                >
                  {loading ? <ActivityIndicator color={THEME.colors.textInverse} /> : <Text style={styles.btnText}>Verify Face Vector</Text>}
                </Pressable>
              </View>
            )}

            {/* STAGE 2: World Selfie Check */}
            {stage === 2 && (
              <View style={styles.stageCard}>
                <Text style={styles.stageTitle}>World Selfie Check Step-Up</Text>
                <Text style={styles.stageSub}>
                  Validates proof of human presence in World App and locks nullifier hash against replay attacks.
                </Text>

                {biometricResult && (
                  <View style={styles.dataBox}>
                    <Text style={{ color: THEME.colors.accentEmerald, fontWeight: '700', fontSize: 13 }}>
                      ✓ Biometric 128d Match Confirmed ({biometricResult.similarityScore * 100}%)
                    </Text>
                    <Text style={{ color: THEME.colors.textSecondary, fontSize: 11, fontFamily: 'monospace' }}>
                      Identified: {biometricResult.identifiedUser}
                    </Text>
                  </View>
                )}

                {typeof window !== 'undefined' && typeof IDKitRequestWidget === 'function' ? (
                  <>
                    <Pressable 
                      onPress={openRealWorldID} 
                      disabled={loading} 
                      style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, { backgroundColor: '#000000', borderColor: '#FFFFFF', borderWidth: 1 }]}
                    >
                      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Verify with World App</Text>}
                    </Pressable>
                    <IDKitRequestWidget
                      open={idkitOpen}
                      onOpenChange={setIdkitOpen}
                      app_id="app_11a0069f40eddb35899a9ec904f3e441"
                      action="face-auth-checkout"
                      rp_context={rpContext}
                      allow_legacy_proofs={true}
                      onError={(err) => setError(`IDKit failed with error: ${err}`)}
                      onSuccess={(proof) => handleWorldProofPass(proof)}
                      handleVerify={async (proof) => {
                        const res = await WorldService.verifyWorldProof({ proofPayload: proof });
                        if (!res.success) throw new Error(res.error);
                      }}
                    />
                    <Pressable 
                      onPress={() => handleWorldProofPass(null)} 
                      disabled={loading} 
                      style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed, { marginTop: 12, backgroundColor: 'transparent', borderColor: THEME.colors.accentEmerald, borderWidth: 1 }]}
                    >
                      {loading ? <ActivityIndicator color={THEME.colors.accentEmerald} /> : <Text style={[styles.btnText, { color: THEME.colors.accentEmerald }]}>⚡ SIMULATE WORLD PROOF (SANDBOX / JUDGE)</Text>}
                    </Pressable>
                  </>
                ) : (
                  <Pressable 
                    onPress={() => handleWorldProofPass(null)} 
                    disabled={loading} 
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                  >
                    {loading ? <ActivityIndicator color={THEME.colors.textInverse} /> : <Text style={styles.btnText}>Simulate World Selfie Pass</Text>}
                  </Pressable>
                )}
              </View>
            )}

            {/* STAGE 3: Graph Query & Settlement */}
            {stage === 3 && (
              <View style={[styles.stageCard, { alignItems: 'center', paddingVertical: 36 }]}>
                <ActivityIndicator size="large" color={THEME.colors.accentEmerald} />
                <Text style={[styles.stageTitle, { marginTop: 16 }]}>Executing On-Chain Settlement...</Text>
                <Text style={styles.stageSub}>Querying Graph Gateway and submitting UserOp to Arc Network</Text>
              </View>
            )}

            {/* STAGE 4: Digital Receipt */}
            {stage === 4 && receipt && (
              <View style={styles.stageCard}>
                <View style={styles.successBadgeBox}>
                  <Text style={styles.successCheck}>✓</Text>
                  <Text style={styles.successTitle}>Payment Settled</Text>
                </View>

                <Text style={styles.receiptAmount}>
                  ${receipt.amount.toFixed(2)} <Text style={{ fontSize: 16, color: THEME.colors.textSecondary }}>{receipt.currency || selectedToken}</Text>
                </Text>

                <View style={styles.dataBox}>
                  <Text style={styles.receiptLine}>Order ID: <Text style={styles.monoValue}>{receipt.orderId}</Text></Text>
                  <Text style={styles.receiptLine}>Tx Hash: <Text style={styles.monoValue}>{(receipt.txHash || '0x...').slice(0, 14)}...</Text></Text>
                  <Text style={styles.receiptLine}>Block Height: <Text style={styles.monoValue}>#{receipt.blockNumber}</Text></Text>
                  <Text style={styles.receiptLine}>World Nullifier: <Text style={styles.monoValue}>{(receipt.proofs?.worldNullifierHash || '0x...').slice(0, 14)}...</Text></Text>
                  <Text style={styles.receiptLine}>Latency: <Text style={styles.monoValue}>{receipt.networkMeta.settlementTimeMs} ms</Text></Text>
                </View>

                <Pressable 
                  onPress={onClose} 
                  style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                >
                  <Text style={styles.btnText}>Done &amp; Close</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(9, 12, 16, 0.88)', justifyContent: 'center', alignItems: 'center', padding: THEME.spacing.lg },
  modalContent: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderMedium, 
    borderWidth: 1, 
    borderRadius: THEME.radius.lg, 
    width: '100%', 
    maxWidth: 520, 
    padding: THEME.spacing.xl 
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: THEME.spacing.md },
  modalCategoryBadge: { marginBottom: 2 },
  modalCategoryText: { color: THEME.colors.accentEmerald, fontSize: 11, fontWeight: '600', letterSpacing: -0.2 },
  title: { color: THEME.colors.textPrimary, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  closeBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: THEME.radius.sm, 
    backgroundColor: THEME.colors.bgElevated, 
    justify: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  btnPressed: { opacity: 0.8 },
  
  pipelineBar: { 
    flexDirection: 'row', 
    gap: 6, 
    backgroundColor: THEME.colors.bgApp, 
    padding: 4, 
    borderRadius: THEME.radius.sm, 
    marginBottom: THEME.spacing.md 
  },
  pipeStepBox: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 4, backgroundColor: 'transparent' },
  pipeActiveBox: { backgroundColor: THEME.colors.bgElevated, borderWidth: 1, borderColor: THEME.colors.borderSubtle },
  pipeStepText: { color: THEME.colors.textMuted, fontSize: 11, fontWeight: '500' },
  pipeActiveText: { color: THEME.colors.accentEmerald, fontWeight: '600' },
  
  errorBox: { 
    backgroundColor: 'rgba(239, 68, 68, 0.12)', 
    borderLeftWidth: 3, 
    borderLeftColor: THEME.colors.accentRed, 
    padding: THEME.spacing.md, 
    borderRadius: THEME.radius.sm,
    marginBottom: THEME.spacing.md 
  },
  errorText: { color: THEME.colors.accentRed, fontSize: 12, lineHeight: 16 },
  
  stageCard: { gap: THEME.spacing.md },
  cameraBox: { 
    height: 180, 
    backgroundColor: '#04070C', 
    borderRadius: THEME.radius.md, 
    justify: 'center', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: THEME.colors.borderMedium 
  },
  reticle: { width: 90, height: 110, borderRadius: 45, borderWidth: 2, borderColor: THEME.colors.accentEmerald, borderStyle: 'dashed' },
  camLabel: { color: THEME.colors.textSecondary, fontSize: 11, marginTop: 10 },
  
  infoRow: { 
    flexDirection: 'row', 
    justify: 'space-between', 
    alignItems: 'center', 
    backgroundColor: THEME.colors.bgElevated, 
    padding: THEME.spacing.md, 
    borderRadius: THEME.radius.sm,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  infoLabel: { color: THEME.colors.textMuted, fontSize: 12 },
  infoVal: { color: THEME.colors.textPrimary, fontWeight: '600', fontSize: 13 },
  
  primaryBtn: { 
    backgroundColor: THEME.colors.accentEmerald, 
    paddingVertical: 14, 
    borderRadius: THEME.radius.sm, 
    alignItems: 'center', 
    minHeight: 46,
    justify: 'center',
    marginTop: 4
  },
  btnText: { color: THEME.colors.textInverse, fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  
  stageTitle: { color: THEME.colors.textPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  stageSub: { color: THEME.colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 17 },
  
  dataBox: { 
    backgroundColor: THEME.colors.bgApp, 
    padding: THEME.spacing.md, 
    borderRadius: THEME.radius.sm, 
    gap: 6,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  successBadgeBox: { alignItems: 'center', gap: 4 },
  successCheck: { fontSize: 28, color: THEME.colors.accentEmerald },
  successTitle: {
    color: THEME.colors.accentEmerald,
    fontSize: 16,
    fontWeight: '700'
  },
  tokenBtn: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    backgroundColor: THEME.colors.bgElevated
  },
  tokenBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)'
  },
  tokenBtnText: {
    color: THEME.colors.textSecondary,
    fontWeight: '600',
    fontSize: 14
  },
  tokenBtnTextActive: {
    color: '#3B82F6'
  },
  receiptAmount: { color: THEME.colors.accentEmerald, fontSize: 28, textAlign: 'center', fontWeight: '700', marginVertical: 4, letterSpacing: -0.5 },
  receiptLine: { color: THEME.colors.textSecondary, fontSize: 12 },
  monoValue: { color: THEME.colors.accentSteel, fontFamily: 'monospace', fontSize: 11 }
});
