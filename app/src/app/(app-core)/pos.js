import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ScanFace } from 'lucide-react-native';

export default function PosScreen() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  const handleCheckout = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      alert("Payment Authorized via Biometric Mandate!");
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#8E8E93" />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        <View style={styles.receipt}>
          <Text style={styles.storeName}>ECHO SOUNDSTAGE</Text>
          <View style={styles.divider} />
          
          <View style={styles.itemRow}>
            <Text style={styles.itemText}>Studio Time (1hr)</Text>
            <Text style={styles.itemText}>$15.00</Text>
          </View>
          <View style={styles.itemRow}>
            <Text style={styles.itemText}>Mic Rental</Text>
            <Text style={styles.itemText}>$5.00</Text>
          </View>
          
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>$20.00</Text>
          </View>
        </View>

        <Pressable 
          style={[styles.payBtn, isScanning && styles.payBtnDisabled]}
          onPress={handleCheckout}
          disabled={isScanning}
        >
          {isScanning ? (
            <Text style={styles.payBtnText}>Authenticating...</Text>
          ) : (
            <>
              <ScanFace size={20} color="#000000" />
              <Text style={styles.payBtnText}>Pay with Mandate</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: { padding: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtnText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  receipt: {
    backgroundColor: '#0a0a0a',
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginBottom: 32,
  },
  storeName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 24 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  itemText: { color: '#8E8E93', fontSize: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  totalValue: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 4,
    width: '100%',
    maxWidth: 400,
    justifyContent: 'center',
  },
  payBtnDisabled: {
    backgroundColor: '#8E8E93',
  },
  payBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
