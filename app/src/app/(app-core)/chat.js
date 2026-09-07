import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, ShieldAlert } from 'lucide-react-native';

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'system',
      text: 'Mandate Agent initialized. Awaiting bounded instructions.',
    }
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: inputText }]);
    setInputText('');

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        text: 'Mandate accepted. Evaluating constraints... \n- Budget: OK\n- Risk: LOW\nExecuting autonomous purchase order.',
      }]);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#8E8E93" />
        </Pressable>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Mandate Agent</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>READY</Text>
          </View>
        </View>
        <View style={{ width: 16 }} />
      </View>

      <View style={styles.guardrailBanner}>
        <ShieldAlert size={14} color="#8E8E93" />
        <Text style={styles.guardrailText}>Active Constraint: Max Spend $5.00 USDC / Tx</Text>
      </View>

      <ScrollView contentContainerStyle={styles.chatScroll} style={styles.chatContainer}>
        {messages.map(msg => (
          <View key={msg.id} style={[
            styles.messageWrapper,
            msg.role === 'user' ? styles.messageUser : styles.messageSystem
          ]}>
            <View style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleSystem
            ]}>
              <Text style={[
                styles.messageText,
                msg.role === 'user' ? styles.messageTextUser : styles.messageTextSystem
              ]}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="e.g., Buy the cheapest compute cluster under $2.00..."
          placeholderTextColor="#8E8E93"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <Pressable style={styles.sendBtn} onPress={handleSend}>
          <Send size={18} color="#000000" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleBox: { alignItems: 'center', gap: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34C759' },
  statusText: { color: '#8E8E93', fontSize: 10, fontFamily: 'monospace' },
  guardrailBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0a0a0a',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  guardrailText: { color: '#8E8E93', fontSize: 12, fontFamily: 'monospace' },
  chatContainer: { flex: 1 },
  chatScroll: { padding: 24, gap: 16 },
  messageWrapper: { width: '100%', flexDirection: 'row' },
  messageUser: { justifyContent: 'flex-end' },
  messageSystem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 16, borderRadius: 4, borderWidth: 1 },
  bubbleUser: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  bubbleSystem: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.15)' },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextUser: { color: '#000000' },
  messageTextSystem: { color: '#FFFFFF', fontFamily: 'monospace' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    color: '#FFFFFF',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
});
