import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, ZoomIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../src/store/useAppStore';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { orderNumber, partyId, source, alertMsg, isOffline, p2pSent } = useLocalSearchParams();
  const setClientInfo = useAppStore(s => s.setClientInfo);
  const [countdown, setCountdown] = useState(10);

  // Auto-redirect para evitar que tela fique travada no totem
  useEffect(() => {
    if (source !== 'vip') {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [source]);

  useEffect(() => {
    if (countdown <= 0) {
      handleFinish();
    }
  }, [countdown]);

  // Bloqueio de hardware back button para não voltar pro orderSummary
  useEffect(() => {
    const onBackPress = () => {
      handleFinish();
      return true;
    };
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSubscription.remove();
  }, []);

  const handleFinish = () => {
    if (source === 'vip') {
      router.replace(`/pedidosBar/selecaoBebidas?partyId=${partyId}`);
    } else {
      // Adiciona curto delay para evitar o erro "Cannot update a component while rendering a different component"
      setTimeout(() => {
        setClientInfo({ name: '', whatsapp: '' });
        router.replace('/');
      }, 0);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#78a764', justifyContent: 'center', padding: 24 }}>
      <Animated.View entering={ZoomIn.duration(600).springify()} style={{ alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: 24, borderRadius: 100, marginBottom: 30 }}>
          <Ionicons name={isOffline === 'true' ? "cloud-done-outline" : "checkmark-done-circle"} size={100} color="#FFF" />
        </View>
        
        <Text style={{ color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
          {p2pSent === 'true' ? 'PEDIDO NO BAR!' : isOffline === 'true' ? 'PEDIDO SALVO!' : 'PEDIDO RECEBIDO!'}
        </Text>
        
        {/* Badge P2P */}
        {p2pSent === 'true' && (
          <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Ionicons name="wifi" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>Entregue via Rede Local do Bar</Text>
          </Animated.View>
        )}
        
        {alertMsg ? (
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: 16, borderRadius: 16, marginBottom: 24 }}>
            <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center', fontWeight: '600' }}>{alertMsg}</Text>
          </View>
        ) : (
          <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 18, textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 }}>
             Sua solicitação já está na fila do bar. Acompanhe a chamada na tela!
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(300)} style={{ alignItems: 'center', backgroundColor: '#FFF', padding: 30, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
        <Text style={{ color: '#707b55', fontSize: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2 }}>
          Seu Número
        </Text>
        <Text style={{ color: '#1c1f0f', fontSize: 72, fontWeight: '900', marginVertical: 10 }}>
          #{orderNumber || '---'}
        </Text>
        <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '500', textAlign: 'center' }}>
          Grave este número.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(600)} style={{ marginTop: 40 }}>
        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#1c1f0f',
            paddingVertical: 20,
            borderRadius: 18,
            alignItems: 'center',
            shadowColor: '#1c1f0f',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <Text style={{ color: '#cc9e6f', fontSize: 18, fontWeight: '800' }}>
            {source === 'vip' ? 'Fazer Novo Pedido' : `Voltar ao Início (${countdown}s)`}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}
