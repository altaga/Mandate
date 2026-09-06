/**
 * @file ProfileScreen.js
 * @description User Profile Screen displaying identity data and live Arc network balances.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useMandate } from '../providers/mandateModule';
import { ArcService } from '../services/arcService';
import { THEME } from '../constants/theme';

export const ProfileScreen = () => {
  const { currentUser } = useMandate();
  const [balance, setBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function getBalance() {
      if (currentUser?.walletAddress) {
        setLoadingBalance(true);
        const balData = await ArcService.fetchOnchainBalance(currentUser.walletAddress);
        if (mounted) {
          setBalance(balData);
          setLoadingBalance(false);
        }
      } else {
        if (mounted) setLoadingBalance(false);
      }
    }
    
    getBalance();
    return () => { mounted = false; };
  }, [currentUser?.walletAddress]);

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Text style={{ color: THEME.colors.textMuted }}>No active profile session.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Cryptographic Identity Profile</Text>
        <Text style={styles.sub}>Verified records stored in Supabase and Arc Network.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Personal Identity</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>Full Name</Text>
          <Text style={styles.val}>{currentUser.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email Address</Text>
          <Text style={styles.val}>{currentUser.email}</Text>
        </View>
        
        <View style={styles.separator} />
        
        <Text style={styles.sectionTitle}>2. Biometrics & World ID</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>128-d Vector Enrolled</Text>
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeSuccessText}>ACTIVE</Text>
          </View>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.label}>World ID Verification</Text>
          {currentUser.worldVerified || currentUser.worldNullifier ? (
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>VERIFIED (SYBIL-RESISTANT)</Text>
            </View>
          ) : (
            <View style={styles.badgeWarning}>
              <Text style={styles.badgeWarningText}>PENDING / NOT LINKED</Text>
            </View>
          )}
        </View>

        {currentUser.worldNullifier && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Nullifier Hash</Text>
            <Text style={styles.valMono}>{(currentUser.worldNullifier || '').slice(0, 20)}...</Text>
          </View>
        )}

        <View style={styles.separator} />

        <Text style={styles.sectionTitle}>3. Arc Network (EVM Wallet)</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Smart Account Address</Text>
          <Text style={styles.valMono}>{currentUser.walletAddress}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.label}>Live USDC Balance</Text>
          {loadingBalance ? (
            <ActivityIndicator color={THEME.colors.accentSteel} size="small" />
          ) : (
            <Text style={styles.valCyan}>{balance ? balance.formatted : '$0.00 USDC'}</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgApp,
  },
  content: {
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  header: {
    gap: 4,
    marginBottom: THEME.spacing.sm,
  },
  title: {
    color: THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  sub: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: THEME.colors.bgSurface,
    borderColor: THEME.colors.borderSubtle,
    borderWidth: 1,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.lg,
    gap: THEME.spacing.md,
  },
  sectionTitle: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  val: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  valMono: {
    color: THEME.colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  valCyan: {
    color: THEME.colors.accentSteel,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  separator: {
    height: 1,
    backgroundColor: THEME.colors.borderSubtle,
    marginVertical: THEME.spacing.sm,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(0, 230, 153, 0.08)',
    borderColor: 'rgba(0, 230, 153, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  badgeSuccessText: {
    color: THEME.colors.accentEmerald,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  badgeWarning: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  badgeWarningText: {
    color: THEME.colors.accentRed,
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
});
