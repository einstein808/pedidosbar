import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { getDatabase, ref, push, set } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useAppStore } from '../src/store/useAppStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import '../../global.css';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineOrder } from '../src/services/offlineQueue';
import { getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { withTimeout } from '../src/utils/firebaseHelpers';
import { sendOrderToBaristaP2P, getBaristaIp } from '../src/services/localClient';

export default function VendaRuaResumoScreen() {
  const selectedDrinks = useAppStore(s => s.selectedDrinks);
  const setSelectedDrinks = useAppStore(s => s.setSelectedDrinks);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [drinksCatalog, setDrinksCatalog] = useState([]);

  useEffect(() => {
    const loadCatalog = async () => {
      const cached = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      setDrinksCatalog(cached);
    };
    loadCatalog();
  }, []);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const getDrinkPrice = (drinkName) => {
    const drink = drinksCatalog.find(d => d.name === drinkName);
    return drink?.price || 0;
  };

  const totalValue = selectedDrinks.reduce((sum, d) => sum + (getDrinkPrice(d.drinkName) * d.quantity), 0);
  const totalDrinks = selectedDrinks.reduce((sum, d) => sum + d.quantity, 0);

  const saveOrder = async () => {
    if (selectedDrinks.length === 0) { Alert.alert('Erro', 'Nenhum drink selecionado.'); return; }
    setLoading(true);
    const db = getDatabase(app);
    const orderNumber = Math.floor(100 + Math.random() * 900).toString();
    const pedidoNovo = {
      offlineId: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      numeroPedido: orderNumber,
      clienteId: 'anonimo',
      nome: 'Venda de Rua',
      whatsapp: '',
      partyId: null,
      drinks: selectedDrinks,
      source: 'rua',
      status: 'pendente',
      totalValue,
      timestamp: new Date().toISOString(),
    };
    try {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        try {
          const orderRef = push(ref(db, 'pedidos'));
          await withTimeout(set(orderRef, pedidoNovo), 4000);
          router.replace({ pathname: '/vendaRua/sucesso', params: { orderNumber, totalValue: totalValue.toFixed(2) } });
          setSelectedDrinks([]);
          return;
        } catch (err) {
          console.warn('Erro Firebase, tentando P2P...', err);
          const baristaIp = await getBaristaIp();
          let p2pSent = false;
          if (baristaIp) { try { await sendOrderToBaristaP2P(pedidoNovo); p2pSent = true; } catch (e) { console.warn('[P2P] Falha:', e.message); } }
          if (!p2pSent) await enqueueOfflineOrder(pedidoNovo);
          router.replace({ pathname: '/vendaRua/sucesso', params: { orderNumber, totalValue: totalValue.toFixed(2), isOffline: 'true', p2pSent: p2pSent ? 'true' : 'false' } });
          setSelectedDrinks([]);
          return;
        }
      } else {
        const baristaIp = await getBaristaIp();
        let p2pSent = false;
        if (baristaIp) { try { await sendOrderToBaristaP2P(pedidoNovo); p2pSent = true; } catch (e) { console.warn('[P2P] Offline total:', e.message); } }
        if (!p2pSent) await enqueueOfflineOrder(pedidoNovo);
        router.replace({ pathname: '/vendaRua/sucesso', params: { orderNumber, totalValue: totalValue.toFixed(2), isOffline: 'true', p2pSent: p2pSent ? 'true' : 'false' } });
        setSelectedDrinks([]);
        return;
      }
    } catch (error) { Alert.alert('Erro', 'Erro ao processar a venda: ' + error.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
            <View style={{ backgroundColor: '#1e824c', borderRadius: 18, padding: 14 }}>
              <Ionicons name="receipt-outline" size={26} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '800' }}>Resumo da Venda</Text>
              <Text style={{ color: '#707b55', fontSize: 14, marginTop: 2 }}>Confira os valores antes de confirmar</Text>
            </View>
          </View>
        </Animated.View>

        {/* Anonymous Client */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <View style={{ marginBottom: 16, padding: 18, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#c8cac6', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(30, 130, 76, 0.12)', borderRadius: 14, padding: 10 }}>
              <Ionicons name="storefront-outline" size={22} color="#1e824c" />
            </View>
            <View>
              <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '700' }}>Venda de Rua</Text>
              <Text style={{ color: '#707b55', fontSize: 13 }}>Cliente anônimo — venda avulsa</Text>
            </View>
          </View>
        </Animated.View>

        {/* Drinks List */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)}>
          <View style={{ marginBottom: 16, padding: 22, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#c8cac6', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#1c1f0f', borderRadius: 14, padding: 10 }}>
                  <Ionicons name="wine-outline" size={22} color="#cc9e6f" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1c1f0f' }}>Drinks</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(30, 130, 76, 0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ color: '#1e824c', fontSize: 16, fontWeight: '800' }}>{totalDrinks}</Text>
                <Text style={{ color: '#1e824c', fontSize: 13, fontWeight: '600' }}>{totalDrinks === 1 ? 'drink' : 'drinks'}</Text>
              </View>
            </View>
            {selectedDrinks.map((item, index) => {
              const unitPrice = getDrinkPrice(item.drinkName);
              const subtotal = unitPrice * item.quantity;
              return (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EA', borderRadius: 14, padding: 16, marginBottom: index < selectedDrinks.length - 1 ? 10 : 0, gap: 14 }}>
                  <View style={{ backgroundColor: 'rgba(30, 130, 76, 0.12)', borderRadius: 12, padding: 10 }}>
                    <Ionicons name="wine-outline" size={22} color="#1e824c" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '600' }}>{item.drinkName}</Text>
                    <Text style={{ color: '#707b55', fontSize: 13, marginTop: 2 }}>{item.quantity}× {formatCurrency(unitPrice)}</Text>
                  </View>
                  <Text style={{ color: '#1e824c', fontSize: 17, fontWeight: '800' }}>{formatCurrency(subtotal)}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Total */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)}>
          <View style={{ marginBottom: 24, padding: 22, borderRadius: 22, backgroundColor: '#1e824c', shadowColor: '#1e824c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="pricetag" size={24} color="rgba(255,255,255,0.8)" />
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' }}>Total</Text>
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>{formatCurrency(totalValue)}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Confirm */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)}>
          <TouchableOpacity onPress={saveOrder} disabled={loading} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e824c', paddingVertical: 20, borderRadius: 18, gap: 10, opacity: loading ? 0.7 : 1, shadowColor: '#1e824c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 }}>
            {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />}
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>{loading ? 'Salvando...' : 'Confirmar Venda'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Back */}
        <Animated.View entering={FadeInUp.duration(500).delay(450)}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 18, borderWidth: 1.5, borderColor: '#c8cac6', gap: 8, marginTop: 12 }}>
            <Ionicons name="arrow-back-outline" size={20} color="#707b55" />
            <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 16 }}>Voltar e Editar</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
