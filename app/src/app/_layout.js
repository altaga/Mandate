import '../core/polyfills';
import { ContextProvider } from "../providers/contextModule";
import SmartProvider from "../providers/smartProvider";
import { MandateProvider } from "../providers/mandateModule";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import "../core/error";
import ContextLoader from "../providers/contextLoader";

export default function RootLayout() {
  return (
    <SmartProvider>
      <ContextProvider>
        <MandateProvider>
          <ContextLoader />
          <Stack
            initialRouteName="(screens)/main"
            screenOptions={{
              animation: "fade",
              headerShown: false,
              contentStyle: { backgroundColor: "#000000" },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(screens)/main" />
            <Stack.Screen name="+not-found" options={{ title: 'Page Not Found' }} />
          </Stack>
          <StatusBar style="light" />
        </MandateProvider>
      </ContextProvider>
    </SmartProvider>
  );
}
