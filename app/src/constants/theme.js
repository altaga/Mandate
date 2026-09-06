/**
 * @file theme.js
 * @description Swiss Dark & Apple-level Precision Design Tokens for Mandate.
 * Enforces deep obsidian surfaces, micro-borders, functional accents, and calibrated geometry.
 */

export const THEME = {
  colors: {
    // Surfaces
    bgApp: '#000000',          // Deep pure obsidian canvas
    bgSurface: '#0A0A0A',      // Primary card and panel container
    bgElevated: '#111111',     // Elevated control, input, and widget surface
    bgHover: '#1A1A1A',        // Hover / Active interactive state
    bgBubbleUser: '#222222',   // Asymmetric user speech / command bubble
    bgBubbleAssistant: '#111111',

    // Micro-Borders
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    borderMedium: 'rgba(255, 255, 255, 0.12)',
    borderFocus: 'rgba(255, 255, 255, 0.24)',
    borderAccent: 'rgba(52, 199, 89, 0.35)',
    borderSlashed: 'rgba(255, 69, 58, 0.40)',

    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#F9F9F6',
    textMuted: '#8E8E93',
    textSubtle: '#52525B',
    textInverse: '#000000',

    // Functional Accents
    accentEmerald: '#34C759',  // Verified proof, SLA compliant, live network
    accentCobalt: '#5E5CE6',   // Arc Network settlement, cryptographic proof
    accentSteel: '#5090D0',    // The Graph telemetry, indexing metrics
    accentViolet: '#BF5AF2',   // World ID human escalation & ZKP
    accentRed: '#FF453A',      // SLA breach, slash penalty, prompt injection blocked
    accentAmber: '#FFD60A',    // Warning, escalation gate pending
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  radius: {
    pill: 9999,
    card: 24,
    input: 28,
    modal: 32,
    sm: 8,
    md: 14,
    bubble: 24,
  },

  typography: {
    titleLarge: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5, color: '#FFFFFF' },
    titleMedium: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: '#FFFFFF' },
    titleSmall: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    body: { fontSize: 14, fontWeight: '400', lineHeight: 20, color: '#8E8E93' },
    caption: { fontSize: 11, fontWeight: '500', color: '#52525B' },
    mono: { fontFamily: 'monospace', fontSize: 12, color: '#5090D0', letterSpacing: 0.5 },
  }
};
