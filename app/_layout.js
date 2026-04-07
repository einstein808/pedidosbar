// app/_layout.js
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useNetworkStore } from "./src/store/useNetworkStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import WarmCache from "./src/components/WarmCache";

export default function Layout() {
  const initNetworkListener = useNetworkStore(s => s.initNetworkListener);

  useEffect(() => {
    initNetworkListener();
  }, [initNetworkListener]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WarmCache />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
