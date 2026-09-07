import { Stack } from "expo-router";

export default function AppCoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: "#000000" },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="home" />
      <Stack.Screen name="pos" />
      <Stack.Screen name="chat" />
    </Stack>
  );
}
