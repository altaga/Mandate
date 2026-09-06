import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dimensions, PixelRatio } from "react-native";
import { Toaster } from "react-native-sonner";
import { THEME } from "../constants/theme";

const SmartSizeContext = createContext({
  width: 0,
  height: 0,
  scale: 1,
  normalize: (size) => size,
});

export const useSmartSize = () => useContext(SmartSizeContext);

export default function SmartProvider({ children }) {
  const [windowDimensions, setWindowDimensions] = useState(
    Dimensions.get("window"),
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setWindowDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const internalSize = useMemo(() => {
    const width = windowDimensions.width;
    const height = windowDimensions.height;

    const baseScale = width / 375;
    const factor = 0.4;
    const moderateScale = 1 + (baseScale - 1) * factor;
    const clampedScale = Math.max(0.85, Math.min(1.2, moderateScale));
    const normalize = (size) => PixelRatio.roundToNearestPixel(size * clampedScale);

    return {
      width,
      height,
      scale: clampedScale,
      normalize,
    };
  }, [windowDimensions]);

  const toasterOptions = {
    toastOptions: {
      style: {
        borderRadius: THEME.radius.md,
        borderWidth: 1,
        borderColor: THEME.colors.borderMedium,
        backgroundColor: THEME.colors.bgElevated,
        color: THEME.colors.textPrimary,
        padding: 14,
        fontFamily: "monospace",
        fontSize: 13,
      },
    },
  };

  return (
    <SmartSizeContext.Provider value={internalSize}>
      {children}
      <Toaster {...toasterOptions} position="bottom-right" />
    </SmartSizeContext.Provider>
  );
}
