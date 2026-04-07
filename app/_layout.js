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

    // Start Real-Time P2P Listener for Guest/VIP device (Totem)
    const { startP2PListener } = require('./src/services/localClient');
    const { useAppStore } = require('./src/store/useAppStore');

    startP2PListener((orderId, novoStatus) => {
      // Updates offline UI globally
      useAppStore.getState().alterarStatusPedidoGlobal(orderId, novoStatus);
    });
  }, [initNetworkListener]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WarmCache />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
