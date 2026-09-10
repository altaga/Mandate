import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import WebcamCapture from './WebcamCapture';
import { IDKitRequestWidget, selfieCheckLegacy } from '@worldcoin/idkit';
import { BiometricService } from '../services/biometricService';
import { CONFIG } from '../constants/config';

export function LoginScreen({ onLoginSuccess, onGoToSignUp }) {
  const [method, setMethod] = useState(null); // 'face' | 'world' | null
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  // World ID State
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);
  const [dynamicAction, setDynamicAction] = useState('face-auth-checkout');
  
  const cameraRef = useRef(null);

  const startWorldIDLogin = async () => {
    setMethod('world');
    setError(null);
    try {
      // Fixed "recognition" action — must match the one used at enrollment so this
      // person's nullifier_hash is identical and enrolled_users.world_nullifier resolves.
      const res = await fetch('/api/sign?purpose=recognition');
      if (!res.ok) throw new Error('Failed to fetch signature');
      const data = await res.json();
      if (data.signature) {
        setRpContext(data);
        if (data.action) setDynamicAction(data.action);
        setIdkitOpen(true);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to initialize World ID connection.');
    }
  };

  const handleWorldIDVerify = async (proof) => {
    try {
      setIsProcessing(true);
      // Verify proof with our backend API
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof, action: dynamicAction })
      });
      const verifyResult = await res.json();
      if (!verifyResult.success) throw new Error(verifyResult.error?.detail || 'World ID verification failed.');
      
      // Look up user in database
      const nullifier_hash = proof.nullifier_hash;
      const identifyResult = await BiometricService.identifyUserByWorldID({ nullifierHash: nullifier_hash });
      
      if (identifyResult.success) {
        onLoginSuccess(identifyResult.identifiedUser);
      } else {
        throw new Error('User not found. Please enroll first.');
      }
    } catch (err) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  const captureFaceAndLogin = async () => {
    if (!cameraRef.current) return;
    try {
      setIsProcessing(true);
      setError(null);
      const photoBase64 = cameraRef.current.capture();
      
      if (!photoBase64) throw new Error("Could not capture photo.");
      
      // Send the raw base64 string to the serverless endpoint for AI processing
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: photoBase64, threshold: 0.85 })
      });
      const result = await res.json();
      
      if (result.success) {
        onLoginSuccess(result.identifiedUser);
      } else {
        setError(result.error || 'Face not recognized in database. Please enroll first.');
        setIsProcessing(false);
      }
    } catch (err) {
      setError(err.message || 'Biometric engine failed to process image.');
      setIsProcessing(false);
    }
  };

  if (method === 'face') {
    return (
      <View style={styles.root}>
        <View style={styles.container}>
          <Text style={styles.title}>FACE ID LOGIN</Text>
          <Text style={styles.subtitle}>Align your face within the frame to authenticate</Text>
          
          <View style={styles.cameraBox}>
            <WebcamCapture ref={cameraRef} width="100%" height={320} />
            <View style={styles.overlay} />
            {isProcessing && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#34C759" size="large" />
                <Text style={styles.loadingText}>ANALYZING 128D VECTOR...</Text>
              </View>
            )}
          </View>
          
          {error && <Text style={styles.errorText}>{error}</Text>}
          
          <View style={styles.buttonRow}>
            <Pressable onPress={() => { setMethod(null); setIsProcessing(false); }} style={[styles.btn, styles.btnOutline]}>
              <Text style={styles.btnTextOutline}>CANCEL</Text>
            </Pressable>
            <Pressable onPress={captureFaceAndLogin} disabled={isProcessing} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnTextPrimary}>SCAN FACE</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.title}>SECURE LOGIN</Text>
        <Text style={styles.subtitle}>Select an authentication method to access the unified platform.</Text>
        
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        <View style={styles.methodList}>
          <Pressable onPress={() => setMethod('face')} style={styles.methodCard}>
            <View style={styles.methodIconBox}>
              <Text style={styles.methodIcon}>👁️</Text>
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>Face ID</Text>
              <Text style={styles.methodDesc}>Instant login using 128-d biometric vector matching via WebRTC.</Text>
            </View>
          </Pressable>

          <Pressable onPress={startWorldIDLogin} style={styles.methodCard}>
            <View style={[styles.methodIconBox, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
              <Text style={styles.methodIcon}>🌐</Text>
            </View>
            <View style={styles.methodDetails}>
              <Text style={styles.methodTitle}>World ID</Text>
              <Text style={styles.methodDesc}>Zero-knowledge proof authentication via Worldcoin Sequencer.</Text>
            </View>
          </Pressable>
        </View>

        {Platform.OS === 'web' && typeof IDKitRequestWidget === 'function' && rpContext && (
          <IDKitRequestWidget
            open={idkitOpen}
            onOpenChange={(isOpen) => {
              setIdkitOpen(isOpen);
              if (!isOpen) {
                setMethod(null);
                setIsProcessing(false);
              }
            }}
            app_id={CONFIG.WORLD_ID.APP_ID}
            action={dynamicAction}
            rp_context={rpContext}
            allow_legacy_proofs={true}
            environment={CONFIG.WORLD_ID.ENVIRONMENT}
            preset={selfieCheckLegacy()}
            onError={(err, debugReport) => {
              console.log("IDKIT WIDGET RETURNED ERROR:", err);
              console.log("DEBUG REPORT:", JSON.stringify(debugReport, null, 2));
              setError(`World ID Error: ${err}`);
            }}
            onSuccess={() => {}}
            handleVerify={handleWorldIDVerify}
          />
        )}
        
        <Pressable onPress={onGoToSignUp} style={{ marginTop: 24, alignSelf: 'center' }}>
          <Text style={{ color: C.textDim, fontSize: 11, fontFamily: C.mono, textDecorationLine: 'underline' }}>
            New User? Create an Account
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const C = {
  bg: '#000000',
  surface: '#0A0A0A',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#F8FAFC',
  textDim: '#94A3B8',
  green: '#34C759',
  red: '#FF3366',
  mono: 'monospace',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { width: '100%', maxWidth: 480, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, padding: 40, borderRadius: 2 },
  title: { color: C.text, fontSize: 24, fontFamily: C.mono, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  subtitle: { color: C.textDim, fontSize: 13, fontFamily: C.mono, lineHeight: 20, marginBottom: 32 },
  methodList: { gap: 16 },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 2 },
  methodIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0, 230, 153, 0.08)', justifyContent: 'center', alignItems: 'center' },
  methodIcon: { fontSize: 20 },
  methodDetails: { flex: 1 },
  methodTitle: { color: C.text, fontSize: 15, fontFamily: C.mono, fontWeight: '700', marginBottom: 4 },
  methodDesc: { color: C.textDim, fontSize: 11, fontFamily: C.mono, lineHeight: 16 },
  cameraBox: { width: '100%', height: 320, borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginBottom: 24, position: 'relative' },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: '10%', left: '15%', right: '15%', bottom: '10%', borderWidth: 1, borderColor: C.green, borderStyle: 'dashed', borderRadius: 100 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9, 12, 16, 0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: C.green, fontSize: 12, fontFamily: C.mono, marginTop: 16, letterSpacing: 1 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 2, borderWidth: 1 },
  btnPrimary: { backgroundColor: C.green, borderColor: C.green },
  btnOutline: { backgroundColor: 'transparent', borderColor: C.border },
  btnTextPrimary: { color: '#000', fontSize: 13, fontFamily: C.mono, fontWeight: '700', letterSpacing: 1 },
  btnTextOutline: { color: C.textDim, fontSize: 13, fontFamily: C.mono, fontWeight: '700', letterSpacing: 1 },
  errorText: { color: C.red, fontSize: 12, fontFamily: C.mono, marginBottom: 16, textAlign: 'center' }
});
