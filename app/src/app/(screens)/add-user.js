import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { EnrollmentScreen } from '../../components/EnrollmentScreen';
import { ArcService } from '../../services/arcService';

// Real, self-serve judge onboarding for Mandate:
// 1. EnrollmentScreen: real face capture + real World ID Selfie Check + a real
//    ERC-4337 smart wallet address, persisted to Cloudflare D1 (mandate-users).
// 2. Once enrolled, authorize a real on-chain USDC Mandate budget from the live
//    Arc Testnet treasury. Nothing here is simulated — a failed enrollment or a
//    failed World ID check cannot reach the grant step.

export default function AddUserScreen() {
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(false);
  const [step, setStep] = useState('idle'); // 'idle' | 'granting' | 'done' | 'error'
  const [amount, setAmount] = useState('0.50');
  const [status, setStatus] = useState('');
  const [grantResult, setGrantResult] = useState(null);

  const handleGrant = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setStatus('Enter an amount greater than $0.00 USDC.');
      return;
    }
    setStep('granting');
    try {
      const mined = await ArcService.grantFromTreasury(n);
      setGrantResult({ amount: n, txHash: mined.txHash });
      setStep('done');
    } catch (err) {
      setStatus(`Grant failed: ${err.message}`);
      setStep('error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#8E8E93" />
        </Pressable>
        <Text style={styles.headerTitle}>Add User to Mandate</Text>
      </View>

      {!enrolled ? (
        <EnrollmentScreen onEnrollSuccess={() => setEnrolled(true)} />
      ) : (
        <View style={styles.body}>
          {step !== 'done' ? (
            <>
              <Text style={styles.title}>Authorize your Mandate</Text>
              <Text style={styles.status}>
                {status || 'Verified human, real wallet on record. Set the USDC budget you authorize this agent to spend.'}
              </Text>
              <Text style={styles.label}>Budget (USDC)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                editable={step !== 'granting'}
              />
              <Pressable
                onPress={handleGrant}
                disabled={step === 'granting'}
                style={[styles.primaryBtn, step === 'granting' && { opacity: 0.6 }]}
              >
                {step === 'granting'
                  ? <ActivityIndicator color="#000000" />
                  : <Text style={styles.primaryBtnText}>CONFIRM MANDATE</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.verifiedBox}>
                <Text style={styles.verifiedLabel}>MANDATE CONFIRMED</Text>
                <Text style={styles.verifiedValue}>${grantResult.amount.toFixed(2)} USDC granted</Text>
                <Text style={styles.txLink}>{ArcService.getExplorerTxUrl(grantResult.txHash)}</Text>
              </View>
              <Pressable
                onPress={() => router.push('/(screens)/demo-chat')}
                style={[styles.primaryBtn, { marginTop: 24 }]}
              >
                <Text style={styles.primaryBtnText}>ENTER MISSION CONTROL</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  status: { color: '#8E8E93', fontSize: 14, textAlign: 'center', maxWidth: 320 },
  primaryBtn: { backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 4, minWidth: 220, alignItems: 'center' },
  primaryBtnText: { color: '#000000', fontWeight: '700', letterSpacing: 1 },
  verifiedBox: { backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)', borderRadius: 8, padding: 16, alignItems: 'center', gap: 6, minWidth: 280 },
  verifiedLabel: { color: '#34C759', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  verifiedValue: { color: '#FFFFFF', fontSize: 14, fontFamily: 'monospace' },
  txLink: { color: '#5090D0', fontSize: 11, fontFamily: 'monospace', marginTop: 6 },
  label: { color: '#8E8E93', fontSize: 12 },
  input: { color: '#FFFFFF', fontSize: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)', padding: 8, minWidth: 160, textAlign: 'center' },
});
