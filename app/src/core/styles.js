import { StyleSheet, Dimensions, Platform } from "react-native";
import { THEME } from "../constants/theme";

export const screenHeight = Dimensions.get("screen").height;
export const windowHeight = Dimensions.get("window").height;

export const createGlobalStyles = ({ normalize = (val) => val } = {}) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: THEME.colors.bgApp,
    },
    card: {
      backgroundColor: THEME.colors.bgSurface,
      borderRadius: THEME.radius.card,
      borderWidth: 1,
      borderColor: THEME.colors.borderSubtle,
      padding: normalize(20),
      overflow: 'hidden',
    },
    elevatedCard: {
      backgroundColor: THEME.colors.bgElevated,
      borderRadius: THEME.radius.card,
      borderWidth: 1,
      borderColor: THEME.colors.borderMedium,
      padding: normalize(20),
    },
    pillButton: {
      backgroundColor: '#FFFFFF',
      borderRadius: THEME.radius.pill,
      paddingVertical: normalize(14),
      paddingHorizontal: normalize(24),
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: normalize(8),
    },
    pillButtonText: {
      color: '#000000',
      fontSize: normalize(15),
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    outlineButton: {
      backgroundColor: 'transparent',
      borderRadius: THEME.radius.pill,
      borderWidth: 1,
      borderColor: THEME.colors.borderMedium,
      paddingVertical: normalize(14),
      paddingHorizontal: normalize(24),
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineButtonText: {
      color: THEME.colors.textPrimary,
      fontSize: normalize(15),
      fontWeight: '500',
    },
    badgePill: {
      paddingHorizontal: normalize(12),
      paddingVertical: normalize(6),
      borderRadius: THEME.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: normalize(6),
    },
  });
};
