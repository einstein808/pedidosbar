import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, BounceIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import '../../global.css';

export default function VendaRuaSucessoScreen() {
  const router = useRouter();
  const { orderNumber, totalValue, isOffline, p2pSent } = useLocalSearchParams();
  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <View style={{ position: 'absolute', top: 60, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(30, 130, 76, 0.08)' }} />
        <View style={{ position: 'absolute', bottom: 80, left: -15, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(204, 158, 111, 0.08)' }} />

        <Animated.View entering={BounceIn.duration(600)}>
          <View style={{ backgroundColor: '#1e824c', borderRadius: 32, padding: 24, marginBottom: 28, shadowColor: '#1e824c', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 }}>
            <Ionicons name="checkmark-done" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ alignItems: 'center' }}>
          <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Venda Registrada!</Text>
          <Text style={{ color: '#707b55', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 280 }}>O pedido foi enviado para o barista.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ marginTop: 28, alignItems: 'center', width: '100%' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, borderWidth: 2, borderColor: '#1e824c', alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 }}>
            <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Nº do Pedido</Text>
            <Text style={{ color: '#1c1f0f', fontSize: 42, fontWeight: '900', letterSpacing: 2 }}>#{orderNumber || '---'}</Text>
            <View style={{ marginTop: 16, backgroundColor: 'rgba(30, 130, 76, 0.08)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="pricetag" size={18} color="#1e824c" />
              <Text style={{ color: '#1e824c', fontSize: 22, fontWeight: '800' }}>{formatCurrency(totalValue)}</Text>
            </View>
            {isOffline === 'true' && (
              <View style={{ marginTop: 12, backgroundColor: p2pSent === 'true' ? 'rgba(91, 155, 213, 0.12)' : 'rgba(212, 160, 23, 0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={p2pSent === 'true' ? 'wifi' : 'cloud-offline-outline'} size={14} color={p2pSent === 'true' ? '#5b9bd5' : '#d4a017'} />
                <Text style={{ color: p2pSent === 'true' ? '#5b9bd5' : '#d4a017', fontSize: 12, fontWeight: '700' }}>
                  {p2pSent === 'true' ? 'Enviado via rede local (P2P)' : 'Salvo offline — sincroniza ao reconectar'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(400)} style={{ width: '100%', gap: 12, marginTop: 32 }}>
          <TouchableOpacity onPress={() => router.replace('/vendaRua')} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e824c', paddingVertical: 18, borderRadius: 16, gap: 10, shadowColor: '#1e824c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 }}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Nova Venda</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/')} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#c8cac6', gap: 8 }}>
            <Ionicons name="home-outline" size={18} color="#707b55" />
            <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 15 }}>Voltar ao Início</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
