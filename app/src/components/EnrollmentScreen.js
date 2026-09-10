/**
 * @file EnrollmentScreen.js
 * @description Biometric & Wallet Registration Screen for Mandate Expo App.
 * Captures face reference embeddings and persists profile to Expo SecureStore.
 */

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Platform } from 'react-native';
import 'react-native-get-random-values';
import { ethers } from 'ethers';
import { useMandate } from '../providers/mandateModule';
import { BiometricService } from '../services/biometricService';
import { THEME } from '../constants/theme';
import { IDKitRequestWidget, selfieCheckLegacy } from '@worldcoin/idkit';
import { CONFIG } from '../constants/config';
import WebcamCapture from './WebcamCapture';

export const EnrollmentScreen = ({ onEnrollSuccess }) => {
  const { currentUser, updateUserProfile } = useMandate();

  const [name, setName] = useState('Victor Alonso');
  const [email, setEmail] = useState('v.a.i@hotmail.com');
  const [generatedWallet, setGeneratedWallet] = useState(currentUser?.walletAddress || null);
  const [loading, setLoading] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  // Validation Checkers
  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isFormValid = isNameValid && isEmailValid;

  // World ID State
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [rpContext, setRpContext] = useState(null);
  const [dynamicAction, setDynamicAction] = useState('face-auth-checkout');
  const [worldIdProof, setWorldIdProof] = useState(null);
  const [initializingFace, setInitializingFace] = useState(false);
  
  // Webcam
  const webcamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const handleCaptureFace = async () => {
    try {
      setInitializingFace(true);
      
      // 1. Capture real photo from WebCam
      if (webcamRef.current) {
        const base64 = webcamRef.current.capture();
        if (base64) {
          setCapturedImage(base64);
        }
      }

      // 2. Init World ID — fixed "recognition" action so this person's nullifier_hash
      // is deterministic and can be matched again on a future World ID login.
      const res = await fetch('/api/sign?purpose=recognition');
      if (!res.ok) throw new Error('Failed to fetch signature');
      const data = await res.json();
      if (data.signature) {
        setRpContext(data);
        if (data.action) setDynamicAction(data.action);
        setIdkitOpen(true);
      }
    } catch (err) {
      console.log('Failed to get RP Context:', err);
    } finally {
      setInitializingFace(false);
    }
  };

  const handleWorldIDSuccess = () => {
    setCaptured(true);
    setCameraActive(false); // turn off camera on success
    if (webcamRef.current) {
      webcamRef.current.stop(); // Stop camera once validated
    }
  };

  const handleVerify = async (proof) => {
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof, action: dynamicAction })
      });
      
      const result = await res.json();
      if (!result.success) {
        throw new Error(`Verify failed: ${JSON.stringify(result.error || result)}`);
      }
      
      setWorldIdProof(proof);
      console.log("Onboarding ZKP Verified on Backend:", result.data);
    } catch (error) {
      console.error('Verify error:', error);
      alert(error.message);
      throw error;
    }
  };

  const handleEnroll = async () => {
    if (!isFormValid) return;
    
    setLoading(true);
    try {
      const agentOwnerWallet = ethers.Wallet.createRandom();
      const agentKey = agentOwnerWallet.privateKey;
      
      // Compute Smart Account Address deterministically
      const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
      const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454';
      const factoryAbi = ['function getAddress(address owner, uint256 salt) view returns (address)'];
      const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);
      
      const newWalletAddress = await factory.getAddress(agentOwnerWallet.address, 0);
      setGeneratedWallet(newWalletAddress);

      // 1. Get the face vector from the Server AI
      let faceVector = null;
      if (capturedImage) {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: capturedImage })
        });
        const result = await res.json();
        if (!result.success) {
          throw new Error(result.error || "Server AI failed to extract vector.");
        }
        faceVector = result.faceVector;
      }

      // 2. Enroll the user using the precomputed vector from the server
      const newProfile = await BiometricService.enrollBiometrics({
        name,
        email,
        walletAddress: newWalletAddress,
        agentKey: agentKey,
        imageSample: capturedImage || worldIdProof?.nullifier_hash || null,
        worldNullifier: worldIdProof?.nullifier_hash || null,
        precomputedVector: faceVector
      });

      const verifiedProfile = { ...newProfile, worldVerified: !!worldIdProof };

      // 3. Save directly to Supabase via backend API
      const dbRes = await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifiedProfile)
      });
      const dbData = await dbRes.json();
      if (!dbData.success) {
        throw new Error(dbData.error || "Failed to save to database");
      }

      await updateUserProfile(verifiedProfile);
      setSuccess(true);
    } catch (err) {
      console.error('Enrollment error:', err);
      alert('Enrollment Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Biometric &amp; Wallet Enrollment</Text>
        <Text style={styles.sub}>
          Link your 128-dimensional facial embedding vector directly with your USDC wallet address.
        </Text>
      </View>

      {success ? (
        <View style={styles.card}>
          <View style={{ alignItems: 'center', gap: 6, marginVertical: 8 }}>
            <Text style={{ fontSize: 32 }}>✓</Text>
            <Text style={{ color: THEME.colors.accentEmerald, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>
              Enrolled Successfully
            </Text>
            <Text style={{ color: THEME.colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
              Your 128-d biometric profile is active for 1-tap checkout.
              {worldIdProof && "\nLinked securely with World ID (Proof of Personhood)."}
            </Text>
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#0A0F16', borderRadius: 9999, borderWidth: 1, borderColor: THEME.colors.borderMedium }}>
              <Text style={{ color: THEME.colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Auto-Generated Smart Wallet Address:</Text>
              <Text style={{ color: THEME.colors.accentEmerald, fontSize: 12, fontFamily: 'monospace' }}>{generatedWallet}</Text>
            </View>
          </View>
          <Pressable 
            onPress={() => {
              if (onEnrollSuccess) {
                onEnrollSuccess();
              } else {
                setSuccess(false); setCaptured(false); setWorldIdProof(null); setCapturedImage(null); setName(''); setEmail(''); setCameraActive(false); 
              }
            }} 
            style={({ pressed }) => [styles.secBtn, pressed && styles.btnPressed]}
          >
            <Text style={{ color: THEME.colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
              {onEnrollSuccess ? 'Return to Login' : 'Register Another Profile'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput 
              style={[styles.input, name.length > 0 && !isNameValid && { borderColor: '#EF4444' }]} 
              value={name} 
              onChangeText={setName} 
              placeholder="Enter your legal name"
              placeholderTextColor={THEME.colors.textMuted} 
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput 
              style={[styles.input, email.length > 0 && !isEmailValid && { borderColor: '#EF4444' }]} 
              value={email} 
              onChangeText={setEmail} 
              keyboardType="email-address" 
              placeholder="name@example.com"
              placeholderTextColor={THEME.colors.textMuted} 
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.fieldGroup, !isFormValid && { opacity: 0.5 }]}>
            <Text style={styles.label}>Live Camera Feed</Text>
            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <View style={[styles.camBox, captured && { borderColor: THEME.colors.accentEmerald }]}>
                {captured ? (
                   <View style={{ alignItems: 'center' }}>
                     <Text style={{ color: THEME.colors.accentEmerald, fontSize: 32, marginBottom: 8 }}>✓</Text>
                     <Text style={{ color: THEME.colors.accentEmerald, fontSize: 11, textAlign: 'center', paddingHorizontal: 16 }}>Face Capture & World ID Complete</Text>
                   </View>
                ) : (
                   isFormValid ? (
                     cameraActive ? (
                       <WebcamCapture ref={webcamRef} width={280} height={280} style={{ borderRadius: 140 }} />
                     ) : (
                       <Pressable onPress={() => setCameraActive(true)} style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                         <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
                         <Text style={{ color: THEME.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>Tap to Enable Camera</Text>
                       </Pressable>
                     )
                   ) : <Text style={{ color: THEME.colors.textMuted, fontSize: 12 }}>Fill details first</Text>
                )}
              </View>
            </View>
          </View>

          {Platform.OS === 'web' && typeof IDKitRequestWidget === 'function' ? (
            <>
              <Pressable 
                onPress={handleCaptureFace} 
                disabled={initializingFace || captured || !isFormValid}
                style={({ pressed }) => [styles.secBtn, (pressed || captured || !isFormValid) && styles.btnPressed, captured && { borderColor: THEME.colors.accentEmerald }, !isFormValid && { opacity: 0.5 }]}
              >
                {initializingFace ? (
                   <ActivityIndicator color={THEME.colors.accentEmerald} size="small" />
                ) : (
                  <Text style={{ color: captured ? THEME.colors.accentEmerald : THEME.colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                    {captured ? 'Identity Locked' : 'Extract Face & Authenticate'}
                  </Text>
                )}
              </Pressable>

              {rpContext && (
                <IDKitRequestWidget
                open={idkitOpen}
                onOpenChange={setIdkitOpen}
                app_id={CONFIG.WORLD_ID.APP_ID}
                action={dynamicAction}
                rp_context={rpContext}
                allow_legacy_proofs={true}
                environment={CONFIG.WORLD_ID.ENVIRONMENT}
                preset={selfieCheckLegacy()}
                onError={(err) => {
                  console.log("Enrollment IDKit Error:", err);
                }}
                onSuccess={handleWorldIDSuccess}
                handleVerify={handleVerify}
              />
              )}
            </>
          ) : (
            <Text style={{ color: THEME.colors.textMuted }}>Web platform required for WebCam.</Text>
          )}

          <Pressable 
            onPress={handleEnroll} 
            disabled={loading || !captured || !isFormValid} 
            style={({ pressed }) => [styles.priBtn, (pressed || !captured || !isFormValid) && styles.btnPressed, (!captured || !isFormValid) && { opacity: 0.5 }]}
          >
            {loading ? <ActivityIndicator color={THEME.colors.textInverse} /> : <Text style={styles.priBtnText}>Complete Biometric Enrollment</Text>}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bgApp },
  content: { padding: THEME.spacing.lg, gap: THEME.spacing.md },
  headerBox: { gap: 4, marginBottom: 4 },
  title: { color: THEME.colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  sub: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  card: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderSubtle, 
    borderWidth: 1, 
    borderRadius: THEME.radius.md, 
    padding: THEME.spacing.lg, 
    gap: THEME.spacing.md 
  },
  fieldGroup: { gap: 6 },
  label: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '600' },
  input: { 
    backgroundColor: THEME.colors.bgApp, 
    borderColor: THEME.colors.borderMedium, 
    borderWidth: 1, 
    borderRadius: THEME.radius.sm, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    color: THEME.colors.textPrimary, 
    fontSize: 13 
  },
  camBox: { 
    width: 280,
    height: 280, 
    backgroundColor: '#04070C', 
    borderRadius: 140, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.borderMedium,
    overflow: 'hidden'
  },
  reticle: { width: 84, height: 104, borderRadius: 42, borderWidth: 2, borderColor: THEME.colors.borderMedium, borderStyle: 'dashed' },
  secBtn: { 
    backgroundColor: THEME.colors.bgElevated, 
    borderColor: THEME.colors.borderMedium, 
    borderWidth: 1, 
    paddingVertical: 12, 
    borderRadius: THEME.radius.sm, 
    alignItems: 'center',
    height: 44,
    justifyContent: 'center'
  },
  priBtn: { 
    backgroundColor: THEME.colors.accentEmerald, 
    paddingVertical: 14, 
    borderRadius: THEME.radius.sm, 
    alignItems: 'center', 
    minHeight: 46,
    justifyContent: 'center',
    marginTop: 4 
  },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  priBtnText: { color: THEME.colors.textInverse, fontWeight: '700', fontSize: 14, letterSpacing: -0.2 }
});

