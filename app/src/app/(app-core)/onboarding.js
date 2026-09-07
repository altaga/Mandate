import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Wallet, Fingerprint } from 'lucide-react-native';

export default function OnboardingScreen() {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topNav}>
        <Pressable onPress={() => router.push('/')}>
          <Text style={styles.backBtnText}>← Back to Home</Text>
        </Pressable>
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepText}>STEP 01</Text>
          <Text style={styles.title}>Initialize Authority</Text>
          <Text style={styles.subtitle}>
            To empower an agent, you must grant it a bounded economic mandate. This links your identity to the agent's smart wallet.
          </Text>
        </View>

        <View style={styles.cardsContainer}>
          <View style={styles.card}>
            <Wallet color="#FFFFFF" size={24} />
            <View style={styles.cardTextGroup}>
              <Text style={styles.cardTitle}>Agent Wallet Deployed</Text>
              <Text style={styles.cardSubtitle}>0xed52...87b4 • Testnet Arc</Text>
            </View>
          </View>
          <View style={[styles.card, { borderColor: 'rgba(52, 199, 89, 0.3)' }]}>
            <Fingerprint color="#34C759" size={24} />
            <View style={styles.cardTextGroup}>
              <Text style={[styles.cardTitle, { color: '#34C759' }]}>Identity Verified</Text>
              <Text style={styles.cardSubtitle}>World ID Nullifier Linked</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.push('/(app-core)/home')}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            style={[
              styles.continueBtn,
              isHovered && styles.continueBtnHovered
            ]}
          >
            <Text style={styles.continueText}>Complete Onboarding</Text>
            <ArrowRight size={18} color="#000000" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topNav: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtnText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 48,
  },
  stepText: {
    color: '#8E8E93',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 15,
    lineHeight: 24,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 48,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
  },
  cardTextGroup: {
    gap: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  footer: {
    marginTop: 20,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 4,
  },
  continueBtnHovered: {
    backgroundColor: '#E5E5EA',
  },
  continueText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
