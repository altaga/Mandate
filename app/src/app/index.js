import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Terminal } from "lucide-react-native";

export default function LandingPage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header / Brand */}
        <View style={styles.header}>
          <View style={styles.brandBox}>
            <Image 
              source={require('../assets/MandateWhite.png')} 
              style={styles.logo} 
              resizeMode="contain" 
            />
            <Text style={styles.brandTitle}>MANDATE</Text>
          </View>
          <Text style={styles.brandSubtitle}>Bounded Economic Authority</Text>
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.heroText}>
            Autonomous Infrastructure for Any Business.
          </Text>
          <Text style={styles.bodyText}>
            Mandate keeps your systems online by giving autonomous AI agents the bounded economic authority to pay for scalable resources, instantly deploy fallback infrastructure, and coordinate with other agents when things go wrong.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionGroup}>
          <ActionButton 
            title="Mission Control" 
            subtitle="Treasury grants and bounded agent spend"
            icon={<Terminal size={20} color="#FFFFFF" />}
            onPress={() => router.push("/(screens)/demo-chat")}
            isPrimary={false}
          />
          <ActionButton
            title="Add User to Mandate"
            subtitle="Verify with World ID and authorize your own agent budget"
            icon={<ArrowRight size={20} color="#000000" />}
            onPress={() => router.push("/(screens)/add-user")}
            isPrimary={true}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({ title, subtitle, icon, onPress, isPrimary }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      style={[
        styles.btnBase,
        isPrimary ? styles.btnPrimary : styles.btnSecondary,
        isHovered && !isPrimary && styles.btnSecondaryHovered,
        isHovered && isPrimary && styles.btnPrimaryHovered,
      ]}
    >
      <View style={styles.btnContent}>
        <Text style={[
          styles.btnTitle,
          isPrimary ? { color: '#000000' } : { color: '#FFFFFF' }
        ]}>{title}</Text>
        <Text style={[
          styles.btnSubtitle,
          isPrimary ? { color: 'rgba(0,0,0,0.6)' } : { color: '#8E8E93' }
        ]}>{subtitle}</Text>
      </View>
      <View style={styles.iconBox}>
        {icon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingVertical: 48,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 20,
  },
  brandBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  brandSubtitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  mainContent: {
    marginTop: -80, // optical centering
    maxWidth: 600,
  },
  heroText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '600',
    lineHeight: 52,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  bodyText: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    maxWidth: '80%',
  },
  actionGroup: {
    gap: 16,
    width: '100%',
    maxWidth: 500,
  },
  btnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderRadius: 4, // Very tight corner radius, Swiss style
    borderWidth: 1,
    transition: 'all 150ms ease',
  },
  btnPrimary: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  btnPrimaryHovered: {
    backgroundColor: '#E5E5EA',
    borderColor: '#E5E5EA',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  btnSecondaryHovered: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  btnContent: {
    gap: 4,
  },
  btnTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  btnSubtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  iconBox: {
    paddingLeft: 16,
  }
});
