import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IDKitRequestWidget, selfieCheckLegacy, setDebug } from '@worldcoin/idkit';

setDebug(true);

const APP_ID = process.env.EXPO_PUBLIC_WORLD_APP_ID;
const ENVIRONMENT = process.env.EXPO_PUBLIC_WORLD_ENVIRONMENT || 'sandbox';

export default function WorldTestScreen() {
  const [rpContext, setRpContext] = useState(null);
  const [dynamicAction, setDynamicAction] = useState('');
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [status, setStatus] = useState('Idle');

  const startWorldIDCheck = async () => {
    try {
      setStatus('Fetching /api/sign...');
      const res = await fetch('/api/sign');
      const data = await res.json();

      if (!data.signature) {
        setStatus(`Sign failed: ${data.error || 'unknown'}`);
        return;
      }

      setRpContext(data);
      setDynamicAction(data.action);
      setStatus('Opening IDKit widget...');
      setIdkitOpen(true);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    }
  };

  const handleVerify = async (proof) => {
    setStatus('Verifying on /api/verify...');
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proof, action: dynamicAction }),
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(JSON.stringify(result.error || result));
    }
    return result;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WORLD ID BLUEPRINT</Text>
      <Text style={styles.subtitle}>Minimal Expo Web + IDKit v4</Text>

      <Pressable onPress={startWorldIDCheck} style={styles.button}>
        <Text style={styles.buttonText}>TEST WORLD ID</Text>
      </Pressable>

      <Text style={styles.status}>Status: {status}</Text>

      {rpContext && (
        <IDKitRequestWidget
          open={idkitOpen}
          onOpenChange={setIdkitOpen}
          app_id={APP_ID}
          action={dynamicAction || 'face-auth-checkout'}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={ENVIRONMENT}
          preset={typeof selfieCheckLegacy === 'function' ? selfieCheckLegacy() : undefined}
          onError={(err) => {
            console.log('IDKit error:', err);
            setStatus(`Widget error: ${err}`);
          }}
          onSuccess={(result) => {
            console.log('IDKit success:', result);
            setStatus(`Success: ${JSON.stringify(result)}`);
          }}
          handleVerify={handleVerify}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
  },
  buttonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    marginTop: 24,
    color: '#34C759',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 480,
  },
});
