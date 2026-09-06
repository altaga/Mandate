/**
 * @file main.js
 * @description Unified App Shell for Mandate.
 * Features a Swiss dark aesthetic navigation shell connecting:
 * 1. Mission Control ($1 Survival Test - Bounded Autonomous Agent)
 * 2. Merchant Storefront (Biometric POS & Delegated Spend)
 * 3. The Graph & Arc Telemetry Inspector
 * 4. Biometric Enrollment (128-d Vector Identity Vault)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MandateScreen } from '../../components/MandateScreen';
import { StorefrontScreen } from '../../components/StorefrontScreen';
import { InspectorScreen } from '../../components/InspectorScreen';
import { EnrollmentScreen } from '../../components/EnrollmentScreen';
import { CheckoutModal } from '../../components/CheckoutModal';
import { LoginScreen } from '../../components/LoginScreen';
import { ProfileScreen } from '../../components/ProfileScreen';
import { useMandate } from '../../providers/mandateModule';
import { THEME } from '../../constants/theme';

export default function Main() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('mission');
  const [session, setSessionState] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const { activeCheckoutItem, setActiveCheckoutItem } = useMandate();
  
  const setSession = (userData) => {
    setSessionState(userData);
    if (typeof localStorage !== 'undefined') {
      if (userData) {
        localStorage.setItem('mandate_active_session', JSON.stringify(userData));
      } else {
        localStorage.removeItem('mandate_active_session');
      }
    }
  };

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('mandate_active_session');
      if (stored) {
        try {
          setSessionState(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to restore session", e);
        }
      }
    }
  }, []);

  if (!session) {
    if (authMode === 'login') {
      return (
        <LoginScreen 
          onLoginSuccess={setSession} 
          onGoToSignUp={() => setAuthMode('signup')} 
        />
      );
    } else {
      return (
        <View style={styles.safeArea}>
          <View style={[styles.topNav, { justifyContent: 'flex-start' }]}>
            <Pressable onPress={() => setAuthMode('login')} style={styles.backBtn}>
              <Text style={{ color: '#FFFFFF', fontSize: 16 }}>←</Text>
              <Text style={styles.backBtnText}>BACK TO LOGIN</Text>
            </Pressable>
          </View>
          <EnrollmentScreen onEnrollSuccess={() => setAuthMode('login')} />
        </View>
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Global Navigation Bar */}
      <View style={styles.topNav}>
        <View style={styles.brandBox}>
          <Text style={styles.brandTitle}>MANDATE</Text>
          <View style={styles.badgeLive}>
            <View style={styles.dotLive} />
            <Text style={styles.badgeText}>ARC // SETTLEMENT</Text>
          </View>
        </View>

        <View style={styles.tabGroup}>
          <NavPill 
            label="MISSION CONTROL" 
            active={activeTab === 'mission'} 
            onPress={() => setActiveTab('mission')} 
          />
          <NavPill 
            label="STOREFRONT" 
            active={activeTab === 'storefront'} 
            onPress={() => setActiveTab('storefront')} 
          />
          <NavPill 
            label="THE GRAPH & ARC LAB" 
            active={activeTab === 'inspector'} 
            onPress={() => setActiveTab('inspector')} 
          />
          <NavPill 
            label="ENROLLMENT" 
            active={activeTab === 'enrollment'} 
            onPress={() => setActiveTab('enrollment')} 
          />
          
          <View style={styles.separator} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable 
              onPress={() => setActiveTab('profile')} 
              style={[
                styles.userPill,
                activeTab === 'profile' && styles.userPillActive
              ]}
            >
              <Text style={[
                styles.userPillText,
                activeTab === 'profile' && { color: '#000000', fontWeight: '700' }
              ]}>
                {session.name.toUpperCase()}
              </Text>
            </Pressable>
            <Pressable onPress={() => setSession(null)} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>LOGOUT</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Screen View Container */}
      <View style={styles.contentContainer}>
        {activeTab === 'mission' && <MandateScreen />}
        {activeTab === 'storefront' && <StorefrontScreen />}
        {activeTab === 'inspector' && <InspectorScreen />}
        {activeTab === 'enrollment' && <EnrollmentScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Active Checkout Modal Overlay */}
      <CheckoutModal 
        visible={Boolean(activeCheckoutItem)} 
        item={activeCheckoutItem} 
        onClose={() => setActiveCheckoutItem(null)} 
      />
    </SafeAreaView>
  );
}

function NavPill({ label, active, onPress }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
      style={[
        styles.pillBtn,
        active && styles.pillBtnActive,
        isHovered && !active && styles.pillBtnHovered
      ]}
    >
      <Text style={[
        styles.pillText,
        active && styles.pillTextActive,
        isHovered && !active && styles.pillTextHovered
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(52, 199, 89, 0.10)',
    borderColor: 'rgba(52, 199, 89, 0.30)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  dotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
  },
  badgeText: {
    color: '#34C759',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'transparent',
    transition: 'all 150ms ease',
  },
  pillBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  pillBtnHovered: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  pillText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pillTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  pillTextHovered: {
    color: '#FFFFFF',
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 12,
  },
  userPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  userPillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  userPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: '#FF453A',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
