// app/_layout.js
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useNetworkStore } from "./src/store/useNetworkStore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import WarmCache from "./src/components/WarmCache";
import { useBootStore } from "./src/store/useBootStore";
import { warmCache } from "./src/services/warmCacheService";

export default function Layout() {
  const initNetworkListener = useNetworkStore(s => s.initNetworkListener);
  const isBooting = useBootStore(s => s.isBooting);
  const hydrate = useBootStore(s => s.hydrate);
  const setBooting = useBootStore(s => s.setBooting);

  useEffect(() => {
    // 1. Warm cache: read all AsyncStorage keys into memory BEFORE any screen renders
    warmCache()
      .then((data) => {
        hydrate(data);
      })
      .finally(() => {
        setBooting(false);
      });

    // 2. Network listener
    initNetworkListener();

    // 3. Start Real-Time P2P Listener for Guest/VIP device (Totem)
    const { startP2PListener } = require('./src/services/localClient');
    const { useAppStore } = require('./src/store/useAppStore');

    startP2PListener((orderId, novoStatus) => {
      useAppStore.getState().alterarStatusPedidoGlobal(orderId, novoStatus);
    });
  }, []);

  // Minimal splash while booting
  if (isBooting) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F0EA', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1c1f0f" />
        <Text style={{ marginTop: 12, color: '#707b55', fontSize: 14, fontWeight: '600' }}>
          Carregando dados...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WarmCache />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
