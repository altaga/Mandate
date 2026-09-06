import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { IDKitRequestWidget, deviceLegacy } from '@worldcoin/idkit';
import { CONFIG } from '../../constants/config';
import WebcamCapture from '../../components/WebcamCapture';

export default function CheckoutScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('0.00');
  const [rpContext, setRpContext] = useState(null);
  const [dynamicAction, setDynamicAction] = useState('face-auth-checkout');
  const [idkitOpen, setIdkitOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle', 'local_scanning', 'processing', 'verifying', 'success'
  const [verificationMethod, setVerificationMethod] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const fadeAnim = useState(new Animated.Value(1))[0];
  const scanFadeAnim = useState(new Animated.Value(0))[0];

  const parsedAmount = parseFloat(amount || '0');
  const isHighRisk = parsedAmount >= 100;
  const isAmountValid = parsedAmount > 0;
  
  // Webcam Ref
  const webcamRef = useRef(null);

  const handleNumpadPress = (val) => {
    if (paymentStatus !== 'idle') return;
    setAmount((prev) => {
      if (val === 'del') {
        if (prev.length <= 1) return '0.00';
        const str = prev.replace('.', '');
        const newStr = str.slice(0, -1);
        const valNum = parseInt(newStr, 10);
        return (valNum / 100).toFixed(2);
      } else {
        const str = prev.replace('.', '');
        const valNum = parseInt(str + val, 10);
        if (valNum > 999999) return prev; // Limit to $9999.99
        return (valNum / 100).toFixed(2);
      }
    });
  };

  const handleLocalFacePay = async () => {
    setPaymentStatus('local_scanning');
    setVerificationMethod('Local Face ID (Backend Verified)');
    
    // UI Scanning feedback
    Animated.sequence([
      Animated.timing(scanFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(scanFadeAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
      Animated.timing(scanFadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    try {
      // 1. Capture real frame from webcam
      if (!webcamRef.current) throw new Error("WebCam not initialized");
      const base64 = webcamRef.current.capture();
      
      if (!base64) throw new Error("Could not capture frame");

      // 2. Send real frame to backend for biometric matching
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, threshold: 0.85 })
      });
      
      const result = await res.json();
      if (!result.success) {
        throw new Error("Biometric Match Failed: Face not recognized.");
      }
      
      console.log("Local Face Authorized:", result.identifiedUser);
      webcamRef.current.stop(); // stop camera
      
      // Stop scanning animation and transition to success
      Animated.timing(scanFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        handlePaymentSuccess();
      });

    } catch (err) {
      console.error(err);
      alert(err.message);
      setPaymentStatus('idle');
      Animated.timing(scanFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  };

  const handleWorldIDPay = async () => {
    try {
      setPaymentStatus('processing');
      setVerificationMethod('World ID (ZK Proof)');
      const res = await fetch('/api/sign');
      if (!res.ok) throw new Error('Failed to fetch signature');
      const data = await res.json();
      if (data.signature) {
        setRpContext(data);
        if (data.action) setDynamicAction(data.action);
        setIdkitOpen(true);
      }
    } catch (err) {
      console.log('Failed to get RP Context:', err);
      setPaymentStatus('idle');
    }
  };

  const handleVerify = async (proof) => {
    setPaymentStatus('verifying');
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
      
      console.log("Verified ZKP on Backend:", result.data);
    } catch (error) {
      console.error('Verify error:', error);
      alert(error.message);
      setPaymentStatus('idle');
      throw error; 
    }
  };

  const handlePaymentSuccess = () => {
    setCameraActive(false);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setPaymentStatus('success');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  };

  const renderNumpad = () => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];
    return (
      <View style={styles.numpad}>
        {keys.map((key, i) => (
          <Pressable 
            key={i} 
            style={({pressed}) => [styles.numKey, pressed && styles.numKeyPressed]} 
            onPress={() => handleNumpadPress(key)}
          >
            <Text style={styles.numKeyText}>{key === 'del' ? '⌫' : key}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>MERCHANT POS</Text>
        <View style={styles.placeholder} />
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {paymentStatus === 'success' ? (
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Payment Confirmed</Text>
            <Text style={styles.successAmount}>${amount} USDC</Text>
            
            <View style={styles.divider} />
            
            <View style={styles.row}>
              <Text style={styles.label}>Verification Method</Text>
              <Text style={[styles.value, { color: isHighRisk ? '#38BDF8' : '#34C759' }]}>{verificationMethod}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Network</Text>
              <Text style={styles.value}>Base L2</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tx Hash</Text>
              <Text style={styles.receipt}>0x8a7...3f2</Text>
            </View>

            <View style={styles.spacer} />
            <Pressable onPress={() => { setPaymentStatus('idle'); setAmount('0.00'); setCameraActive(false); }} style={styles.returnBtn}>
              <Text style={styles.returnBtnText}>NEW TRANSACTION</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.posContainer}>
            <View style={styles.displaySection}>
              <Text style={styles.currencyLabel}>USDC</Text>
              <Text style={[styles.amountDisplay, amount === '0.00' && { color: '#64748B' }]}>
                ${amount}
              </Text>
              <View style={styles.riskBadgeContainer}>
                {parsedAmount > 0 && (
                  <View style={[styles.riskBadge, isHighRisk ? styles.riskBadgeHigh : styles.riskBadgeLow]}>
                    <Text style={[styles.riskBadgeText, isHighRisk ? styles.riskBadgeTextHigh : styles.riskBadgeTextLow]}>
                      {isHighRisk ? 'HIGH RISK (>$100)' : 'LOW RISK (<$100)'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* In Low Risk Mode, show webcam instead of numpad once activated */}
            {!isHighRisk && isAmountValid && paymentStatus === 'idle' && Platform.OS === 'web' && (
              <View style={{ marginBottom: 20, alignItems: 'center' }}>
                <View style={{ width: 280, height: 280, borderRadius: 140, borderWidth: 2, borderColor: '#34C759', backgroundColor: '#04070C', overflow: 'hidden' }}>
                  {cameraActive ? (
                    <WebcamCapture 
                      ref={webcamRef} 
                      width="100%" 
                      height="100%" 
                    />
                  ) : (
                    <Pressable onPress={() => setCameraActive(true)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 32, marginBottom: 8 }}>📷</Text>
                      <Text style={{ color: '#34C759', fontSize: 13, fontWeight: '600' }}>Tap to Enable Camera</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {paymentStatus === 'idle' && renderNumpad()}

            <View style={styles.actionSection}>
              {paymentStatus === 'local_scanning' && (
                <Animated.View style={[styles.scanOverlay, { opacity: scanFadeAnim }]}>
                  <Text style={styles.scanText}>[ ANALYZING FACE EMBEDDING... ]</Text>
                </Animated.View>
              )}

              {Platform.OS === 'web' && typeof IDKitRequestWidget === 'function' ? (
                <>
                  <Pressable 
                    style={[
                      styles.payButton, 
                      isHighRisk ? styles.payButtonHighRisk : styles.payButtonLowRisk,
                      (!isAmountValid || (paymentStatus !== 'idle' && paymentStatus !== 'local_scanning')) && styles.payButtonDisabled
                    ]} 
                    onPress={isHighRisk ? handleWorldIDPay : handleLocalFacePay}
                    disabled={!isAmountValid || (paymentStatus !== 'idle' && paymentStatus !== 'local_scanning')}
                  >
                    <Text style={[styles.payButtonText, isHighRisk && { color: '#000000' }]}>
                      {paymentStatus === 'processing' ? 'INITIALIZING WORLD ID...' : 
                       paymentStatus === 'verifying' ? 'CRYPTOGRAPHIC VERIFICATION...' :
                       paymentStatus === 'local_scanning' ? 'VALIDATING BIOMETRICS...' :
                       isHighRisk ? 'SECURE WORLD ID CHECK' : 'QUICK FACE PAY'}
                    </Text>
                  </Pressable>

                  {rpContext && (
                    <IDKitRequestWidget
                      open={idkitOpen}
                      onOpenChange={(open) => {
                        setIdkitOpen(open);
                        if (!open && paymentStatus === 'processing') setPaymentStatus('idle');
                      }}
                      app_id={CONFIG.WORLD_ID.APP_ID}
                      action={dynamicAction}
                      rp_context={rpContext}
                      allow_legacy_proofs={true}
                      preset={deviceLegacy()}
                      onError={(err) => {
                        console.log("FacePay IDKit Error:", err);
                        setPaymentStatus('idle');
                      }}
                      onSuccess={handlePaymentSuccess}
                      handleVerify={handleVerify}
                    />
                  )}
                </>
              ) : (
                <Text style={styles.errorText}>World ID / WebCam is only supported on Web in this demo.</Text>
              )}
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center' },
  header: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: { padding: 8 },
  backText: { color: '#94A3B8', fontSize: 14, fontWeight: '500', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  headerTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  placeholder: { width: 60 },
  content: { flex: 1, width: '100%', maxWidth: 420, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  posContainer: { flex: 1, justifyContent: 'space-between' },
  
  displaySection: { alignItems: 'center', marginBottom: 40 },
  currencyLabel: { color: '#64748B', fontSize: 16, fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  amountDisplay: { color: '#F8FAFC', fontSize: 64, fontWeight: '300', tabularNums: true },
  riskBadgeContainer: { height: 32, marginTop: 16, justifyContent: 'center' },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  riskBadgeLow: { backgroundColor: 'rgba(0, 230, 153, 0.1)', borderColor: 'rgba(0, 230, 153, 0.2)' },
  riskBadgeHigh: { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.2)' },
  riskBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  riskBadgeTextLow: { color: '#34C759' },
  riskBadgeTextHigh: { color: '#38BDF8' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 40 },
  numKey: { width: '30%', aspectRatio: 1.2, backgroundColor: '#11161F', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  numKeyPressed: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  numKeyText: { color: '#F8FAFC', fontSize: 24, fontWeight: '400' },
  
  actionSection: { position: 'relative', height: 80, justifyContent: 'flex-end' },
  scanOverlay: { position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' },
  scanText: { color: '#34C759', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2 },
  
  payButton: { paddingVertical: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  payButtonLowRisk: { backgroundColor: 'transparent', borderColor: '#34C759' },
  payButtonHighRisk: { backgroundColor: '#38BDF8', borderColor: '#38BDF8' },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { fontSize: 15, fontWeight: '700', letterSpacing: 1.2, color: '#34C759' },
  
  successCard: { backgroundColor: '#11161F', borderRadius: 16, padding: 40, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center' },
  successIconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 255, 255, 0.05)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successIcon: { color: '#F8FAFC', fontSize: 32, fontWeight: '300' },
  successTitle: { color: '#94A3B8', fontSize: 14, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  successAmount: { color: '#F8FAFC', fontSize: 40, fontWeight: '300', marginBottom: 32 },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginBottom: 24 },
  row: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  label: { color: '#64748B', fontSize: 14 },
  value: { color: '#E2E8F0', fontSize: 14, fontWeight: '500' },
  receipt: { color: '#64748B', fontSize: 13, fontFamily: 'monospace', backgroundColor: 'rgba(255, 255, 255, 0.05)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  spacer: { height: 24 },
  returnBtn: { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, width: '100%', alignItems: 'center' },
  returnBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', letterSpacing: 1.2 },
  errorText: { color: '#EF4444', textAlign: 'center', marginTop: 20 },
});
