import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import "../../global.css";

export default function NoActivePartyScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const checkAgain = async () => {
    setLoading(true);
    try {
      const db = getDatabase(app);
      const partiesRef = ref(db, 'festas');
      const snapshot = await get(partiesRef);
      
      if (snapshot.exists()) {
        const parties = snapshot.val();
        const activePartyKey = Object.keys(parties).find(k => parties[k].status === 'ativa');
        if (activePartyKey) {
          router.replace('/pedidosBar');
          return;
        }
      }
      Alert.alert('Fila fechada', 'O barista ainda não ativou a festa. Aguarde a liberação.');
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View entering={FadeInUp.duration(600)} style={{ alignItems: 'center', width: '100%' }}>
          <View
            style={{
              backgroundColor: 'rgba(200, 60, 60, 0.08)',
              borderRadius: 40,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <Ionicons name="lock-closed" size={48} color="#c83c3c" />
          </View>

          <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 }}>
            Fila Fechada
          </Text>
          
          <Text style={{ color: '#707b55', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 36, paddingHorizontal: 12 }}>
            A fila de pedidos online ainda não foi liberada pelo caixa. Aguarde a ativação da festa para escanear e fazer seu pedido.
          </Text>

          <View style={{ width: '100%', gap: 14 }}>
            <TouchableOpacity
              onPress={checkAgain}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1c1f0f',
                paddingVertical: 18,
                borderRadius: 20,
                gap: 12,
                shadowColor: '#1c1f0f',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              {loading ? <ActivityIndicator color="#cc9e6f" size="small" /> : <Ionicons name="refresh" size={20} color="#cc9e6f" />}
              <Text style={{ color: '#cc9e6f', fontWeight: '800', fontSize: 16 }}>
                Tentar Novamente
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace('/')}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                paddingVertical: 18,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: '#e8e4de',
                gap: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <Ionicons name="home-outline" size={20} color="#707b55" />
              <Text style={{ color: '#707b55', fontWeight: '700', fontSize: 16 }}>
                Voltar ao Início
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
