import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStore } from '../../store/useNetworkStore';

export default function OfflineBanner() {
  const isOffline = useNetworkStore(s => s.isOffline);
  const offlineQueueCount = useNetworkStore(s => s.offlineQueueCount);

  if (!isOffline) return null;

  return (
    <View
      style={{
        backgroundColor: '#cc9e6f',
        paddingVertical: 8,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#1c1f0f" />
      <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 13 }}>
        Modo Offline{offlineQueueCount > 0 ? ` • ${offlineQueueCount} na fila` : ''}
      </Text>
    </View>
  );
}
