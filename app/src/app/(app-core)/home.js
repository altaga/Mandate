import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TerminalSquare, ShoppingCart, Activity } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>Elena Rostova</Text>
        </View>
        <View style={styles.balanceBadge}>
          <Text style={styles.balanceText}>$20.00 USDC</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>MANDATE WORKSPACE</Text>
        
        <View style={styles.grid}>
          <MenuCard 
            title="Agent Chat" 
            subtitle="Issue a new mandate" 
            icon={<TerminalSquare size={24} color="#FFFFFF" />}
            onPress={() => router.push('/(app-core)/chat')}
          />
          <MenuCard 
            title="Merchant POS" 
            subtitle="Test biometric checkout" 
            icon={<ShoppingCart size={24} color="#FFFFFF" />}
            onPress={() => router.push('/(app-core)/pos')}
          />
        </View>

        <View style={styles.recentActivity}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          <View style={styles.activityCard}>
            <View style={styles.activityIcon}>
              <Activity size={16} color="#8E8E93" />
            </View>
            <View style={styles.activityInfo}>
              <Text style={styles.activityTitle}>System Initialization</Text>
              <Text style={styles.activityTime}>Just now</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuCard({ title, subtitle, icon, onPress }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.menuCard,
        isHovered && styles.menuCardHovered
      ]}
    >
      <View style={styles.cardIconBox}>{icon}</View>
      <View style={styles.cardTextGroup}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  greeting: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  balanceBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  balanceText: {
    color: '#34C759',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 24,
  },
  sectionTitle: {
    color: '#8E8E93',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  menuCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: 24,
    transition: 'all 150ms ease',
  },
  menuCardHovered: {
    backgroundColor: '#141414',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardIconBox: {
    marginBottom: 16,
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
  },
  recentActivity: {
    marginTop: 10,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityInfo: {
    gap: 4,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  activityTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
});
