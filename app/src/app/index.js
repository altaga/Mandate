import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Terminal, ArrowDown, ArrowLeft } from "lucide-react-native";

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

        <View style={styles.contentRow}>
          <View style={styles.leftColumn}>
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
              <View style={styles.actionRow}>
                <View style={{ width: 340 }}>
                  <ActionButton 
                    title="Mission Control" 
                    subtitle="Treasury grants and bounded agent spend"
                    icon={<Terminal size={20} color="#FFFFFF" />}
                    onPress={() => router.push("/(screens)/demo-chat")}
                    isPrimary={false}
                  />
                </View>
                <View style={styles.actionPointer}>
                  <ArrowLeft size={24} color="#FFFFFF" />
                  <Text style={styles.actionPointerText}>JUMP STRAIGHT TO DEMO</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <View style={{ width: 340 }}>
                  <ActionButton
                    title="Add User to Mandate"
                    subtitle="Verify with World ID and authorize your own agent budget"
                    icon={<ArrowRight size={20} color="#000000" />}
                    onPress={() => router.push("/(screens)/add-user")}
                    isPrimary={true}
                  />
                </View>
                <View style={styles.actionPointer}>
                  <ArrowLeft size={24} color="#FFFFFF" />
                  <Text style={styles.actionPointerText}>OR ONBOARD FIRST (OPTIONAL)</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.rightColumn}>
            <Text style={styles.instructionTitle}>HOW TO USE MANDATE</Text>
            
            <View style={styles.explicitStep}>
              <View style={styles.stepCircle}><Text style={styles.stepCircleText}>1</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Add a User</Text>
                <Text style={styles.stepDesc}>Enroll your face and create an agent budget via World ID.</Text>
              </View>
            </View>

            <View style={styles.arrowContainer}>
              <ArrowDown size={16} color="#333333" />
            </View>

            <View style={styles.explicitStep}>
              <View style={styles.stepCircle}><Text style={styles.stepCircleText}>2</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Enter Mission Control</Text>
                <Text style={styles.stepDesc}>Type "Start" in the chat to grant your agent $1.00 USDC.</Text>
              </View>
            </View>

            <View style={styles.arrowContainer}>
              <ArrowDown size={16} color="#333333" />
            </View>

            <View style={styles.explicitStep}>
              <View style={styles.stepCircle}><Text style={styles.stepCircleText}>3</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Inject Chaos</Text>
                <Text style={styles.stepDesc}>Use the left panel to break infrastructure. Watch the agent fix it.</Text>
              </View>
            </View>

            <View style={styles.arrowContainer}>
              <ArrowDown size={16} color="#333333" />
            </View>

            <View style={styles.explicitStep}>
              <View style={styles.stepCircle}><Text style={styles.stepCircleText}>4</Text></View>
              <View style={styles.stepContent}>
                <Text style={styles.stepHeading}>Trigger Escalation</Text>
                <Text style={styles.stepDesc}>Break the database ($1.20 fix). The agent will ask YOU for permission.</Text>
              </View>
            </View>
          </View>
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
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 40,
    marginTop: -20,
  },
  leftColumn: {
    flex: 1,
    minWidth: 400,
    maxWidth: 600,
    gap: 40,
  },
  rightColumn: {
    flex: 1,
    minWidth: 320,
    maxWidth: 450,
    backgroundColor: '#0A0A0A',
    padding: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  mainContent: {
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
  instructionTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 24,
  },
  explicitStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleText: {
    color: '#5090D0',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDesc: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 20,
  },
  arrowContainer: {
    width: 32,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionGroup: {
    gap: 20,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionPointer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 12,
  },
  actionPointerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  btnBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
    flex: 1,
    flexShrink: 1,
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
