import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { getDatabase, ref, push, set, get } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useAppStore } from '../src/store/useAppStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import '../../global.css';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { enqueueOfflineOrder } from '../src/services/offlineQueue';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { withTimeout } from '../src/utils/firebaseHelpers';
import { sendOrderToBaristaP2P, getBaristaIp } from '../src/services/localClient';

export default function OrderSummaryScreen() {
  const clientInfo = useAppStore(s => s.clientInfo);
  const setClientInfo = useAppStore(s => s.setClientInfo);
  const selectedDrinks = useAppStore(s => s.selectedDrinks);
  const setSelectedDrinks = useAppStore(s => s.setSelectedDrinks);
  const party = useAppStore(s => s.festaSelecionada);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const totalDrinks = selectedDrinks.reduce((sum, d) => sum + d.quantity, 0);

  // Reduz estoque apenas no cache local para uso offline
  const decreaseLocalOfflineStock = async (partyId, drinksList) => {
    try {
      const cachedEstoque = await getCachedData(CACHE_KEYS.ESTOQUE, {});
      const cachedDrinks = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      if (Object.keys(cachedEstoque).length === 0 || cachedDrinks.length === 0) return;

      let hasChanges = false;
      const estoqueAtual = { ...cachedEstoque };

      for (const item of drinksList) {
        const realDrink = cachedDrinks.find(d => d.name === item.drinkName);
        if (realDrink && realDrink.fichaTecnica) {
          for (const ficha of realDrink.fichaTecnica) {
            const idInsumo = ficha.insumoId;
            if (idInsumo && estoqueAtual[idInsumo]) {
              const qtdGasta = parseFloat(ficha.quantity) * item.quantity;
              if (!isNaN(qtdGasta) && qtdGasta > 0) {
                estoqueAtual[idInsumo].quantidadeAtual -= qtdGasta;
                hasChanges = true;
              }
            }
          }
        }
      }

      if (hasChanges) {
        await cacheData(CACHE_KEYS.ESTOQUE, estoqueAtual);
      }
    } catch (e) {
      console.error('Erro ao reduzir estoque local:', e);
    }
  };

  const saveOrder = async () => {
    if (!clientInfo.id || !party || selectedDrinks.length === 0) {
      Alert.alert('Erro', 'Dados do pedido incompletos.');
      return;
    }

    setLoading(true);
    const db = getDatabase(app);
    
    const orderNumber = Math.floor(100 + Math.random() * 900).toString();
    
    const pedidoNovo = {
      offlineId: `local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      numeroPedido: orderNumber,
      clienteId: clientInfo.id,
      nome: clientInfo.name,
      whatsapp: clientInfo.whatsapp,
      partyId: party.id,
      drinks: selectedDrinks,
      source: clientInfo.role === 'vip' ? 'vip' : 'totem',
      status: 'pendente',
      timestamp: new Date().toISOString(),
    };

    try {
      const state = await NetInfo.fetch();
      
      if (state.isConnected) {
        try {
          const orderRef = push(ref(db, 'pedidos'));
          await withTimeout(set(orderRef, pedidoNovo), 4000);
          
          // ---- BAIXA AUTOMÁTICA DE ESTOQUE ----
          try {
            const drinksSnapshot = await withTimeout(get(ref(db, 'drinks')), 3000);
            const drinksData = drinksSnapshot.exists() ? drinksSnapshot.val() : {};

            const estoqueRef = ref(db, `festas/${party.id}/estoque`);
            const estoqueSnapshot = await withTimeout(get(estoqueRef), 3000);
            
            if (estoqueSnapshot.exists() && Object.keys(drinksData).length > 0) {
               const estoqueAtual = estoqueSnapshot.val();
               let alertas = [];
               let hasChanges = false;
               
               for (const item of selectedDrinks) {
                  const realDrink = Object.values(drinksData).find(d => d.name === item.drinkName);
                  if (realDrink && realDrink.fichaTecnica) {
                     for (const ficha of realDrink.fichaTecnica) {
                        const idInsumo = ficha.insumoId;
                        if (idInsumo && estoqueAtual[idInsumo]) {
                           const qtdGasta = parseFloat(ficha.quantity) * item.quantity;
                           if (!isNaN(qtdGasta) && qtdGasta > 0) {
                             estoqueAtual[idInsumo].quantidadeAtual -= qtdGasta;
                             hasChanges = true;
                             
                             const perc = estoqueAtual[idInsumo].quantidadeAtual / estoqueAtual[idInsumo].quantidadeInicial;
                             if (perc <= 0.20 && perc > 0) {
                                alertas.push(estoqueAtual[idInsumo].nome);
                             }
                           }
                        }
                     }
                  }
               }
               
               if (hasChanges) {
                  await set(estoqueRef, estoqueAtual);
               }
               
               if (alertas.length > 0) {
                  const unicos = [...new Set(alertas)];
                  // Em vez de só dar alert, navegamos e mandamos msg
                  router.replace({
                    pathname: '/pedidosBar/orderSuccess',
                    params: { orderNumber, partyId: party.id, source: clientInfo.role === 'vip' ? 'vip' : 'totem', alertMsg: `Atenção: Os seguintes insumos (<20%) estão quase esgotando:\n${unicos.join(', ')}` }
                  });
                  setSelectedDrinks([]);
                  return;
               }
               
               // Sucesso Limpo
               router.replace({
                 pathname: '/pedidosBar/orderSuccess',
                 params: { orderNumber, partyId: party.id, source: clientInfo.role === 'vip' ? 'vip' : 'totem' }
               });
               setSelectedDrinks([]);
               return;
            } else {
               router.replace({
                 pathname: '/pedidosBar/orderSuccess',
                 params: { orderNumber, partyId: party.id, source: clientInfo.role === 'vip' ? 'vip' : 'totem' }
               });
               setSelectedDrinks([]);
               return;
            }
          } catch (stkErr) {
             console.log("Erro na baixa de estoque", stkErr);
             router.replace({
               pathname: '/pedidosBar/orderSuccess',
               params: { orderNumber, partyId: party.id, source: clientInfo.role === 'vip' ? 'vip' : 'totem', alertMsg: 'Salvo, mas alerta: Falha ao reduzir estoque interno.' }
             });
             setSelectedDrinks([]);
             return;
          }
          // ---- FIM DA BAIXA AUTOMÁTICA ----
        } catch (err) {
          console.warn('Erro via Firebase push, tentando P2P local...', err);
          
          // --- FALLBACK P2P: Tenta enviar direto pro Tablet Barista via TCP ---
          const baristaIp = await getBaristaIp();
          let p2pSent = false;
          
          if (baristaIp) {
            try {
              await sendOrderToBaristaP2P(pedidoNovo);
              p2pSent = true;
              console.log('[P2P] Pedido entregue ao Barista via rede local!');
            } catch (p2pErr) {
              console.warn('[P2P] Falha no envio local:', p2pErr.message);
            }
          }
          
          // Se P2P falhou também, enfileira local para sync posterior
          if (!p2pSent) {
            await enqueueOfflineOrder(pedidoNovo);
          }
          
          await decreaseLocalOfflineStock(party.id, selectedDrinks);
          router.replace({
             pathname: '/pedidosBar/orderSuccess',
             params: {
               orderNumber,
               partyId: party.id,
               source: clientInfo.role === 'vip' ? 'vip' : 'totem',
               isOffline: 'true',
               p2pSent: p2pSent ? 'true' : 'false'
             }
          });
          setSelectedDrinks([]);
          return;
        }
      } else {
        // Sem conexão alguma com Firebase - tenta P2P primeiro
        const baristaIp = await getBaristaIp();
        let p2pSent = false;
        
        if (baristaIp) {
          try {
            await sendOrderToBaristaP2P(pedidoNovo);
            p2pSent = true;
            console.log('[P2P] Pedido entregue ao Barista via rede local (modo offline total)!');
          } catch (p2pErr) {
            console.warn('[P2P] Fallback também falhou:', p2pErr.message);
          }
        }
        
        if (!p2pSent) {
          await enqueueOfflineOrder(pedidoNovo);
        }
        
        await decreaseLocalOfflineStock(party.id, selectedDrinks);
        router.replace({
           pathname: '/pedidosBar/orderSuccess',
           params: {
             orderNumber,
             partyId: party.id,
             source: clientInfo.role === 'vip' ? 'vip' : 'totem',
             isOffline: 'true',
             p2pSent: p2pSent ? 'true' : 'false'
           }
        });
        setSelectedDrinks([]);
        return;
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao processar o pedido: ' + error.message);
      console.log('Party ID:', party?.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
            <View style={{ backgroundColor: '#1c1f0f', borderRadius: 18, padding: 14 }}>
              <Ionicons name="receipt-outline" size={26} color="#cc9e6f" />
            </View>
            <View>
              <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '800' }}>
                Resumo do Pedido
              </Text>
              <Text style={{ color: '#707b55', fontSize: 14, marginTop: 2 }}>
                Confira os dados antes de confirmar
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Seção Cliente */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <View
            style={{
              marginBottom: 16,
              padding: 22,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <View style={{ backgroundColor: '#1c1f0f', borderRadius: 14, padding: 10 }}>
                <Ionicons name="person-outline" size={22} color="#cc9e6f" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1c1f0f' }}>Cliente</Text>
            </View>

            {/* Nome */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F0EA',
              borderRadius: 14,
              padding: 16,
              marginBottom: 10,
              gap: 12,
            }}>
              <Ionicons name="person" size={20} color="#cc9e6f" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#707b55', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Nome</Text>
                <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '600' }}>
                  {clientInfo.name || 'Não informado'}
                </Text>
              </View>
            </View>

            {/* WhatsApp */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F0EA',
              borderRadius: 14,
              padding: 16,
              gap: 12,
            }}>
              <Ionicons name="logo-whatsapp" size={20} color="#78a764" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#707b55', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>WhatsApp</Text>
                <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '600' }}>
                  {clientInfo.whatsapp || 'Não informado'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Seção Festa */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)}>
          <View
            style={{
              marginBottom: 16,
              padding: 22,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <View style={{ backgroundColor: '#1c1f0f', borderRadius: 14, padding: 10 }}>
                <Ionicons name="calendar-outline" size={22} color="#78a764" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#1c1f0f' }}>Festa</Text>
            </View>

            {/* Nome da Festa */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F0EA',
              borderRadius: 14,
              padding: 16,
              marginBottom: 10,
              gap: 12,
            }}>
              <Ionicons name="sparkles" size={20} color="#78a764" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#707b55', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Nome</Text>
                <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '600' }}>
                  {party?.nome || 'Carregando...'}
                </Text>
              </View>
            </View>

            {/* Data */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F5F0EA',
              borderRadius: 14,
              padding: 16,
              gap: 12,
            }}>
              <Ionicons name="calendar" size={20} color="#cc9e6f" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#707b55', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Data</Text>
                <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '600' }}>
                  {party?.data || 'Carregando...'}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Seção Drinks */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)}>
          <View
            style={{
              marginBottom: 24,
              padding: 22,
              borderRadius: 22,
              backgroundColor: '#FFFFFF',
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ backgroundColor: '#1c1f0f', borderRadius: 14, padding: 10 }}>
                  <Ionicons name="wine-outline" size={22} color="#cc9e6f" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1c1f0f' }}>Drinks</Text>
              </View>
              <View style={{
                backgroundColor: 'rgba(120, 167, 100, 0.15)',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
                <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '800' }}>{totalDrinks}</Text>
                <Text style={{ color: '#78a764', fontSize: 13, fontWeight: '600' }}>
                  {totalDrinks === 1 ? 'drink' : 'drinks'}
                </Text>
              </View>
            </View>

            {selectedDrinks.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="wine-outline" size={36} color="#c8cac6" />
                <Text style={{ color: '#c8cac6', fontSize: 16, marginTop: 8, fontStyle: 'italic' }}>
                  Nenhum drink selecionado
                </Text>
              </View>
            ) : (
              selectedDrinks.map((item, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F5F0EA',
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: index < selectedDrinks.length - 1 ? 10 : 0,
                    gap: 14,
                  }}
                >
                  <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 12, padding: 10 }}>
                    <Ionicons name="wine-outline" size={22} color="#78a764" />
                  </View>
                  <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '600', flex: 1 }}>
                    {item.drinkName}
                  </Text>
                  <View style={{
                    backgroundColor: '#78a764',
                    borderRadius: 12,
                    minWidth: 38,
                    height: 38,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                  }}>
                    <Text style={{ color: '#FFF', fontSize: 17, fontWeight: '800' }}>
                      {item.quantity}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        {/* Botão Confirmar */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)}>
          <TouchableOpacity
            onPress={saveOrder}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#78a764',
              paddingVertical: 20,
              borderRadius: 18,
              gap: 10,
              opacity: loading ? 0.7 : 1,
              shadowColor: '#78a764',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={24} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
              {loading ? 'Salvando...' : 'Confirmar Pedido'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Botão Voltar */}
        <Animated.View entering={FadeInUp.duration(500).delay(450)}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              paddingVertical: 18,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              gap: 8,
              marginTop: 12,
            }}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#707b55" />
            <Text style={{ color: '#707b55', fontWeight: '600', fontSize: 16 }}>
              Voltar e Editar
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}