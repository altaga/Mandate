import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IDKitRequestWidget, selfieCheckLegacy, setDebug } from '@worldcoin/idkit';
import { CONFIG } from '../constants/config';

setDebug(true);

export default function WorldTestScreen() {
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);
  const [status, setStatus] = useState('Idle');
  const handlePress = async () => {
    try {
      setStatus('Fetching signature...');
      const res = await fetch('/api/sign');
      if (!res.ok) throw new Error('Failed to fetch signature');
      const data = await res.json();
      
      if (data.signature) {
        setRpContext(data);
        setStatus('Opening widget...');
        setIdkitOpen(true);
      } else {
        setStatus('Invalid signature response');
      }
    } catch (err) {
      console.error('Failed to get RP Context:', err);
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WORLD ID ISOLATED TEST</Text>
      
      <Pressable onPress={handlePress} style={styles.button}>
        <Text style={styles.buttonText}>TEST AUTHORIZATION</Text>
      </Pressable>
      
      <Text style={styles.status}>Status: {status}</Text>
      {rpContext && (
        <IDKitRequestWidget
          open={idkitOpen}
          onOpenChange={setIdkitOpen}
          app_id={CONFIG.WORLD_ID.APP_ID}
          action="face-auth-checkout"
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={CONFIG.WORLD_ID.ENVIRONMENT}
          preset={typeof selfieCheckLegacy === 'function' ? selfieCheckLegacy() : undefined}
          onError={(err, debugReport) => {
            console.log("IDKIT WIDGET RETURNED ERROR:", err);
            console.log("DEBUG REPORT:", JSON.stringify(debugReport, null, 2));
            alert(`World ID Error: ${err}\nCheck console for debug report.`);
            setStatus(`Widget Error: ${err}`);
          }}
          onSuccess={(result) => {
            console.log("IDKIT SUCCESS:", result);
            setStatus('Success: ' + JSON.stringify(result));
          }}
          handleVerify={async (proof) => {
            console.log("IDKIT VERIFY:", proof);
            setStatus('Verifying proof...');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090C10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: '#00E699',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 40,
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#00E699',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  buttonText: {
    color: '#090C10',
    fontWeight: 'bold',
    fontSize: 16,
  },
  status: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 20,
  }
});
