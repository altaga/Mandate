/**
 * @file StorefrontScreen.js
 * @description Merchant POS Storefront Screen for Mandate Expo App.
 * Displays concert CD album merchandise and triggers biometric face checkout.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView } from 'react-native';
import { useMandate } from '../providers/mandateModule';
import { CONFIG } from '../constants/config';
import { THEME } from '../constants/theme';

export const StorefrontScreen = () => {
  const { currentUser, setActiveCheckoutItem } = useMandate();
  const [qty, setQty] = useState(1);

  const product = {
    title: 'Echoes in the Dark — Deluxe Concert Album',
    subtitle: 'Physical CD + Exclusive High-Res NFT Pass',
    unitPrice: 24.99,
    merchant: 'Echo Soundstage Official Merch',
    merchantWallet: CONFIG.ARC_NETWORK.MERCHANT_CONTRACT,
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'
  };

  const totalPrice = (product.unitPrice * qty).toFixed(2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Verified Merchant Header Card */}
      <View style={styles.merchantCard}>
        <View style={styles.merchantHeaderRow}>
          <View style={styles.merchantAvatar}>
            <Text style={{ fontSize: 14 }}>🎵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <Text style={styles.merchantName}>{product.merchant}</Text>
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedDot} />
                <Text style={styles.badgeText}>Verified</Text>
              </View>
            </View>
            <Text style={styles.railText}>Contract: {product.merchantWallet ? `${String(product.merchantWallet).slice(0, 8)}...${String(product.merchantWallet).slice(-6)}` : 'Environment Configured'}</Text>
          </View>
        </View>
      </View>

      {/* Product Card */}
      <View style={styles.productCard}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: product.image }} style={styles.prodImage} resizeMode="cover" />
          <View style={styles.tagOverlay}>
            <Text style={styles.tagText}>Official Concert Merch</Text>
          </View>
        </View>

        <View style={styles.prodMeta}>
          <Text style={styles.prodTitle}>{product.title}</Text>
          <Text style={styles.prodSub}>{product.subtitle}</Text>
        </View>

        {/* Pricing Controls Bar */}
        <View style={styles.priceRow}>
          <View>
            <Text style={styles.priceLabel}>Unit Price</Text>
            <Text style={styles.priceText}>${product.unitPrice} <Text style={styles.currencySuffix}>USDC</Text></Text>
          </View>

          <View style={styles.qtyRow}>
            <Pressable 
              onPress={() => setQty(Math.max(1, qty - 1))} 
              style={({ pressed }) => [styles.qtyBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.qtyBtnText}>−</Text>
            </Pressable>
            <Text style={styles.qtyVal}>{qty}</Text>
            <Pressable 
              onPress={() => setQty(qty + 1)} 
              style={({ pressed }) => [styles.qtyBtn, pressed && styles.btnPressed]}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Total & Checkout Trigger */}
        <View style={styles.checkoutFooter}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Payment Due</Text>
            <Text style={styles.totalVal}>${totalPrice} USDC</Text>
          </View>

          <Pressable
            onPress={() => setActiveCheckoutItem({
              name: `${product.title} (x${qty})`,
              priceUsdc: Number(totalPrice),
              merchant: product.merchant
            })}
            style={({ pressed }) => [styles.payBtn, pressed && styles.payBtnPressed]}
          >
            <Text style={styles.payBtnText}>Pay with Face (${totalPrice} USDC)</Text>
          </Pressable>

          {currentUser && (
            <View style={styles.profileBox}>
              <Text style={styles.profileFooter}>
                Enrolled Profile: <Text style={{ color: THEME.colors.textPrimary, fontWeight: '600' }}>{currentUser.name}</Text> {currentUser.walletAddress ? `(${currentUser.walletAddress.slice(0, 6)}...${currentUser.walletAddress.slice(-4)})` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bgApp },
  content: { padding: THEME.spacing.lg, gap: THEME.spacing.lg },
  merchantCard: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderSubtle, 
    borderWidth: 1, 
    borderRadius: THEME.radius.card, 
    padding: THEME.spacing.md 
  },
  merchantHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: THEME.spacing.md },
  merchantAvatar: { 
    width: 36, 
    height: 36, 
    borderRadius: THEME.radius.pill, 
    backgroundColor: THEME.colors.bgElevated, 
    justify: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: THEME.spacing.sm },
  merchantName: { color: THEME.colors.textPrimary, fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  verifiedBadge: { 
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 230, 153, 0.12)', 
    borderColor: 'rgba(0, 230, 153, 0.25)', 
    borderWidth: 1, 
    paddingHorizontal: 7, 
    paddingVertical: 2, 
    borderRadius: THEME.radius.pill 
  },
  verifiedDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: THEME.colors.accentEmerald },
  badgeText: { color: THEME.colors.accentEmerald, fontSize: 10, fontWeight: '600' },
  railText: { color: THEME.colors.accentSteel, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  
  productCard: { 
    backgroundColor: THEME.colors.bgSurface, 
    borderColor: THEME.colors.borderSubtle, 
    borderWidth: 1, 
    borderRadius: THEME.radius.card, 
    padding: THEME.spacing.lg, 
    gap: THEME.spacing.md 
  },
  imageContainer: { position: 'relative', width: '100%', height: 210, borderRadius: THEME.radius.card, overflow: 'hidden' },
  prodImage: { width: '100%', height: '100%' },
  tagOverlay: { 
    position: 'absolute', 
    top: 12, 
    left: 12, 
    backgroundColor: 'rgba(9, 12, 16, 0.85)', 
    borderColor: 'rgba(255, 255, 255, 0.12)', 
    borderWidth: 1, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: THEME.radius.pill 
  },
  tagText: { color: THEME.colors.accentSteel, fontSize: 11, fontWeight: '600' },
  
  prodMeta: { gap: 4 },
  prodTitle: { color: THEME.colors.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, lineHeight: 24 },
  prodSub: { color: THEME.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  
  priceRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: THEME.colors.bgElevated, 
    paddingHorizontal: THEME.spacing.md, 
    paddingVertical: THEME.spacing.md, 
    borderRadius: THEME.radius.pill,
    borderWidth: 1,
    borderColor: THEME.colors.borderSubtle
  },
  priceLabel: { color: THEME.colors.textMuted, fontSize: 11 },
  priceText: { color: THEME.colors.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  currencySuffix: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '500' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: THEME.spacing.md },
  qtyBtn: { 
    backgroundColor: THEME.colors.bgHover, 
    width: 32, 
    height: 32, 
    borderRadius: THEME.radius.pill, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.borderMedium
  },
  btnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  qtyBtnText: { color: THEME.colors.textPrimary, fontSize: 16, fontWeight: '600' },
  qtyVal: { color: THEME.colors.textPrimary, fontWeight: '700', fontSize: 15 },
  
  checkoutFooter: { marginTop: 4, gap: THEME.spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: THEME.colors.textSecondary, fontSize: 13 },
  totalVal: { color: THEME.colors.accentEmerald, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  payBtn: { 
    backgroundColor: THEME.colors.accentEmerald, 
    paddingVertical: 14, 
    borderRadius: THEME.radius.pill, 
    alignItems: 'center',
    shadowColor: THEME.colors.accentEmerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  payBtnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  payBtnText: { color: THEME.colors.textInverse, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  profileBox: { alignItems: 'center', paddingTop: 4 },
  profileFooter: { color: THEME.colors.textMuted, fontSize: 11, textAlign: 'center' }
});

