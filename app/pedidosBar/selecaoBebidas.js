import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useAppStore } from '../src/store/useAppStore';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, SlideInUp } from 'react-native-reanimated';
import '../../global.css';
import { SafeAreaView } from 'react-native-safe-area-context';

import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function DrinksSelectionScreen() {
  const selectedDrinks = useAppStore(s => s.selectedDrinks);
  const setSelectedDrinks = useAppStore(s => s.setSelectedDrinks);
  const [drinks, setDrinks] = useState([]);
  const [filter, setFilter] = useState('alcoholic');
  const [cartExpanded, setCartExpanded] = useState(false);
  const [expandedDrink, setExpandedDrink] = useState(null);
  const [isPartyActive, setIsPartyActive] = useState(true);
  const router = useRouter();
  const { partyId } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isOffline = useNetworkStore(s => s.isOffline);
  const [activeVIPDrinksCount, setActiveVIPDrinksCount] = useState(0);
  const [activeVIPOrders, setActiveVIPOrders] = useState([]);
  const clientInfo = useAppStore(s => s.clientInfo);
  const offlineQueueCount = useNetworkStore(s => s.offlineQueueCount);
  const updateQueueCount = useNetworkStore(s => s.updateQueueCount);

  const numColumns = width > 768 ? 4 : 3;

  useEffect(() => {
    // 1. Tentar ler do Cache primeiro
    const loadCachedDrinks = async () => {
      const cached = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      if (cached.length > 0) {
        setDrinks(cached.filter((drink) => !drink.inactive));
      }
    };
    loadCachedDrinks();

    // 2. Subscrever ao Firebase para dados atualizados
    const db = getDatabase(app);
    const drinksRef = ref(db, 'drinks/');
    const unsubscribeFirebase = onValue(drinksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fullCatalog = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        cacheData(CACHE_KEYS.DRINKS_CATALOG, fullCatalog);
        setDrinks(fullCatalog.filter((drink) => !drink.inactive));
      } else if (!isOffline) {
        // Só zera quando online de verdade (não há drinks no Firebase)
        setDrinks([]);
      }
      // Se offline e data=null, mantém os dados do cache
    });

    // 3. Monitorar Status da Festa (Fase 3: Proteção)
    let unsubscribeParty = () => {};
    if (partyId) {
      const partyRef = ref(db, `festas/${partyId}`);
      unsubscribeParty = onValue(partyRef, (snapshot) => {
        const pData = snapshot.val();
        if (pData && pData.status !== 'ativa') {
          setIsPartyActive(false);
          setCartExpanded(false);
        } else {
          setIsPartyActive(true);
        }
      });
    }
    
    // 4. Monitoramento da Cota VIP (Máximo 2 drinks)
    let unsubscribeVIPOrders = () => {};
    if (clientInfo?.role === 'vip' && clientInfo?.id) {
      const ordersRef = ref(db, 'pedidos');
      unsubscribeVIPOrders = onValue(ordersRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          let count = 0;
          let myOrders = [];
          for (const key in data) {
            const order = data[key];
            if (order.clienteId === clientInfo.id && 
               ['pendente', 'em-preparo', 'pronto'].includes(order.status)) {
               count += (order.drinks || []).reduce((sum, d) => sum + d.quantity, 0);
               myOrders.push({ id: key, ...order });
            }
          }
          // Ordena por prioridade de urgência (pronto -> preparo -> pendente)
          myOrders.sort((a, b) => {
             const weights = { 'pronto': 3, 'em-preparo': 2, 'pendente': 1 };
             return (weights[b.status] || 0) - (weights[a.status] || 0);
          });
          setActiveVIPDrinksCount(count);
          setActiveVIPOrders(myOrders);
        } else {
          setActiveVIPDrinksCount(0);
          setActiveVIPOrders([]);
        }
      });
    }

    return () => {
      unsubscribeFirebase();
      unsubscribeParty();
      unsubscribeVIPOrders();
    };
  }, [partyId, clientInfo, isOffline]);

  const filteredDrinks = drinks.filter((drink) => {
    if (filter === 'all') return true;
    return filter === 'alcoholic'
      ? drink.type === 'alcoholic'
      : drink.type === 'non-alcoholic';
  });

  const totalDrinksCount = selectedDrinks.reduce((sum, d) => sum + d.quantity, 0);

  const addDrink = (drink) => {
    if (!isPartyActive) {
      Alert.alert('🚨 Atenção', 'A festa está pausada ou foi encerrada. Novos pedidos não são permitidos no momento.');
      return;
    }
    if (clientInfo?.role === 'vip') {
      if (totalDrinksCount + 1 + activeVIPDrinksCount > 2) {
        Alert.alert(
          'Aguarde um momento ✋',
          'Temos um limite de 2 drinks simultâneos. Busque seus drinks abertos ou aguarde a entrega para pedir outro.'
        );
        return;
      }
    }
    const index = selectedDrinks.findIndex((d) => d.drinkName === drink.name);
    if (index !== -1) {
      const updated = [...selectedDrinks];
      updated[index].quantity += 1;
      setSelectedDrinks(updated);
    } else {
      setSelectedDrinks([...selectedDrinks, { drinkName: drink.name, quantity: 1 }]);
    }
  };

  const removeDrink = (drinkName) => {
    if (!isPartyActive) return;
    const updated = selectedDrinks
      .map((d) => (d.drinkName === drinkName ? { ...d, quantity: d.quantity - 1 } : d))
      .filter((d) => d.quantity > 0);
    setSelectedDrinks(updated);
  };

  const removeAll = (drinkName) => {
    const updated = selectedDrinks.filter((d) => d.drinkName !== drinkName);
    setSelectedDrinks(updated);
  };

  const clearCart = () => {
    Alert.alert(
      'Limpar pedido',
      'Deseja remover todos os drinks do pedido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: () => setSelectedDrinks([]) },
      ]
    );
  };

  const handleNext = () => {
    if (selectedDrinks.length === 0) {
      Alert.alert('Erro', 'Selecione pelo menos um drink.');
      return;
    }
    router.push(`/pedidosBar/orderSummary?partyId=${partyId}`);
  };

  const renderItem = ({ item }) => {
    const selected = selectedDrinks.find((d) => d.drinkName === item.name);
    return (
      <Animated.View
        entering={FadeInUp.duration(500)}
        style={{
          flex: 1,
          marginHorizontal: 4,
          marginBottom: 12,
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
          borderWidth: 1.5,
          borderColor: selected ? '#78a764' : '#c8cac6',
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
          overflow: 'hidden',
        }}
      >
        <TouchableOpacity
          onPress={() => addDrink(item)}
          onLongPress={() => setExpandedDrink(item)}
          delayLongPress={500}
          activeOpacity={0.85}
        >
          {/* Badge de quantidade */}
          {selected && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 10,
                backgroundColor: '#78a764',
                borderRadius: 14,
                minWidth: 28,
                height: 28,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>
                {selected.quantity}
              </Text>
            </View>
          )}
          {item.image && (
            <Image
              source={{ uri: item.image }}
              style={{ width: '100%', height: 120, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
              resizeMode="cover"
            />
          )}
          <View style={{ padding: 12, gap: 4 }}>
            <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: item.type === 'alcoholic'
                  ? 'rgba(204, 158, 111, 0.15)'
                  : 'rgba(120, 167, 100, 0.15)',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  color: item.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {item.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Sem álcool'}
              </Text>
            </View>
            <Text style={{ color: '#707b55', fontSize: 13 }} numberOfLines={2}>
              {item.ingredients}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filterData = [
    { key: 'alcoholic', label: 'Alcoólicos' },
    { key: 'non-alcoholic', label: 'Sem Álcool' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <OfflineBanner />

      <View style={{ flex: 1, backgroundColor: '#F5F0EA', padding: 16 }}>
        
        {clientInfo?.role === 'vip' && activeVIPOrders.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            {/* Banner de Cota */}
            <Animated.View entering={FadeInUp.duration(400)} style={{ 
              marginBottom: 12, 
              backgroundColor: 'rgba(204, 158, 111, 0.12)', 
              padding: 12, 
              borderRadius: 14, 
              borderWidth: 1.5, 
              borderColor: 'rgba(204, 158, 111, 0.3)', 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 12 
            }}>
              <Ionicons name="information-circle" size={24} color="#cc9e6f" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#cc9e6f', fontSize: 13, fontWeight: '700' }}>
                  Cota VIP: Máximo de 2 drinks no balcão
                </Text>
                <Text style={{ color: '#cc9e6f', fontSize: 12 }}>
                  Você possui <Text style={{fontWeight: '800'}}>{activeVIPDrinksCount}</Text> drink(s) pendentes. Ao atingir 2, busque para liberar mais!
                </Text>
              </View>
            </Animated.View>

            {/* Acompanhamento de Pedidos */}
            <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800', marginBottom: 10, paddingHorizontal: 4 }}>
              Seus Pedidos em Andamento:
            </Text>
            {activeVIPOrders.map((order, index) => {
              const statusConfig = {
                'pendente': { color: '#cc9e6f', label: 'Na Fila', icon: 'time-outline' },
                'em-preparo': { color: '#d4a017', label: 'Preparando', icon: 'restaurant-outline' },
                'pronto': { color: '#78a764', label: 'PRONTO! BUSQUE NO BALCÃO', icon: 'checkmark-circle' }
              };
              const st = statusConfig[order.status] || statusConfig['pendente'];
              
              const isPronto = order.status === 'pronto';
              const borderCol = isPronto ? '#78a764' : '#c8cac6';
              const bgCol = isPronto ? 'rgba(120, 167, 100, 0.1)' : '#FFFFFF';

              return (
                <Animated.View key={order.id} entering={FadeInUp.duration(300).delay(index * 100)} style={{
                  backgroundColor: bgCol,
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: isPronto ? 2 : 1.5,
                  borderColor: borderCol,
                  marginBottom: 10,
                  shadowOffset: {width: 0, height: 2},
                  shadowOpacity: 0.05,
                  shadowRadius: 5,
                  elevation: 1
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name={st.icon} size={18} color={st.color} />
                      <Text style={{ color: st.color, fontSize: 14, fontWeight: '800' }}>{st.label}</Text>
                    </View>
                    <Text style={{ color: '#707b55', fontSize: 11, fontWeight: '600' }}>
                      {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                  <View style={{ gap: 4 }}>
                    {(order.drinks || []).map((d, i) => (
                      <Text key={i} style={{ color: '#1c1f0f', fontSize: 13, fontWeight: '600' }}>
                        <Text style={{ color: '#78a764', fontWeight: '800'}}>×{d.quantity}</Text> {d.drinkName}
                      </Text>
                    ))}
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}

        <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '700', marginBottom: 20, textAlign: 'center' }}>
          Selecionar Drinks
        </Text>

        {/* Filtros */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 8 }}>
          {filterData.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: filter === f.key ? '#1c1f0f' : '#FFFFFF',
                borderWidth: filter === f.key ? 0 : 1.5,
                borderColor: '#c8cac6',
                alignItems: 'center',
              }}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.85}
            >
              <Text
                style={{
                  color: filter === f.key ? '#cc9e6f' : '#707b55',
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid */}
        <FlatList
          key={numColumns}
          data={filteredDrinks}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 4 }}
          contentContainerStyle={{ paddingBottom: 140 }}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />

        {/* ===== CARRINHO FLUTUANTE ===== */}
        {selectedDrinks.length > 0 && (
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            {/* Card expandido */}
            {cartExpanded && (
              <View
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: '#78a764',
                  padding: 20,
                  marginBottom: 12,
                  maxHeight: 320,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: -4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="cart" size={20} color="#78a764" />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700' }}>Seu Pedido</Text>
                    <View style={{ backgroundColor: '#78a764', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' }}>
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{totalDrinksCount}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={clearCart} activeOpacity={0.7} style={{ backgroundColor: 'rgba(200, 60, 60, 0.08)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="trash-outline" size={18} color="#c83c3c" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCartExpanded(false)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(112, 123, 85, 0.1)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="chevron-down" size={18} color="#707b55" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Lista */}
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
                  {selectedDrinks.map((drink, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(112, 123, 85, 0.06)',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ color: '#1c1f0f', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                          {drink.drinkName}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity onPress={() => removeDrink(drink.drinkName)} activeOpacity={0.7}
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(200, 60, 60, 0.08)', borderWidth: 1.5, borderColor: 'rgba(200, 60, 60, 0.4)', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="remove" size={20} color="#c83c3c" />
                        </TouchableOpacity>
                        <View style={{ minWidth: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(120, 167, 100, 0.12)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }}>
                          <Text style={{ color: '#78a764', fontSize: 16, fontWeight: '700' }}>{drink.quantity}</Text>
                        </View>
                        <TouchableOpacity onPress={() => addDrink({ name: drink.drinkName })} activeOpacity={0.7}
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(120, 167, 100, 0.12)', borderWidth: 1.5, borderColor: '#78a764', justifyContent: 'center', alignItems: 'center' }}>
                          <Ionicons name="add" size={20} color="#78a764" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeAll(drink.drinkName)} activeOpacity={0.7}
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(200, 202, 198, 0.3)', justifyContent: 'center', alignItems: 'center', marginLeft: 4 }}>
                          <Ionicons name="close" size={18} color="#707b55" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Barra inferior */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setCartExpanded(!cartExpanded)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderWidth: 1.5,
                  borderColor: '#78a764',
                  gap: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.08,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons name="cart" size={22} color="#78a764" />
                <View style={{ backgroundColor: '#78a764', borderRadius: 12, minWidth: 26, height: 26, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 }}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>{totalDrinksCount}</Text>
                </View>
                <Ionicons name={cartExpanded ? 'chevron-down' : 'chevron-up'} size={16} color="#707b55" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#1c1f0f',
                  borderRadius: 14,
                  paddingVertical: 16,
                  gap: 8,
                  shadowColor: '#1c1f0f',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 16 }}>Próximo</Text>
                <Ionicons name="arrow-forward" size={18} color="#cc9e6f" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {/* Modal Expandido (Long Press) */}
      <Modal
        visible={!!expandedDrink}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setExpandedDrink(null)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(28, 31, 15, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}>
          <Animated.View
            entering={SlideInUp.duration(400).springify()}
            style={{
              backgroundColor: '#F5F0EA',
              borderRadius: 28,
              width: screenWidth - 32,
              maxHeight: screenHeight * 0.85,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 16,
            }}
          >
            {/* Botão minimizar no topo */}
            <TouchableOpacity
              onPress={() => setExpandedDrink(null)}
              activeOpacity={0.7}
              style={{
                position: 'absolute',
                top: 14,
                right: 14,
                zIndex: 10,
                backgroundColor: 'rgba(28, 31, 15, 0.7)',
                borderRadius: 20,
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={22} color="#F5F0EA" />
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={{ paddingBottom: 30 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Imagem grande */}
              {expandedDrink?.image && (
                <Image
                  source={{ uri: expandedDrink.image }}
                  style={{
                    width: '100%',
                    height: screenHeight * 0.35,
                    borderTopLeftRadius: 28,
                    borderTopRightRadius: 28,
                  }}
                  resizeMode="cover"
                />
              )}

              <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
                {/* Nome do drink em destaque */}
                <Text style={{
                  color: '#1c1f0f',
                  fontSize: 32,
                  fontWeight: '800',
                  marginBottom: 12,
                  letterSpacing: -0.5,
                }}>
                  {expandedDrink?.name}
                </Text>

                {/* Badge tipo */}
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: expandedDrink?.type === 'alcoholic'
                      ? 'rgba(204, 158, 111, 0.2)'
                      : 'rgba(120, 167, 100, 0.2)',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 14,
                    marginBottom: 24,
                  }}
                >
                  <Text style={{
                    color: expandedDrink?.type === 'alcoholic' ? '#cc9e6f' : '#78a764',
                    fontSize: 16,
                    fontWeight: '700',
                  }}>
                    {expandedDrink?.type === 'alcoholic' ? '🍸 Alcoólico' : '🍹 Não Alcoólico'}
                  </Text>
                </View>

                {/* Seção ingredientes */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                }}>
                  <View style={{
                    backgroundColor: '#1c1f0f',
                    borderRadius: 12,
                    padding: 8,
                  }}>
                    <Ionicons name="list-outline" size={20} color="#cc9e6f" />
                  </View>
                  <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 20 }}>Ingredientes</Text>
                </View>

                {(
                  Array.isArray(expandedDrink?.ingredients)
                    ? expandedDrink.ingredients
                    : typeof expandedDrink?.ingredients === 'string'
                      ? expandedDrink.ingredients.split(',')
                      : []
                ).map((ingredient, index) => (
                  <View key={index} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 10,
                    paddingLeft: 6,
                    paddingVertical: 8,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    borderWidth: 1,
                    borderColor: '#e8e4de',
                  }}>
                    <Ionicons name="leaf-outline" size={18} color="#78a764" />
                    <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '500', flex: 1 }}>
                      {ingredient.trim()}
                    </Text>
                  </View>
                ))}

                {/* Descrição se existir */}
                {expandedDrink?.description && (
                  <View style={{ marginTop: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <View style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 8 }}>
                        <Ionicons name="document-text-outline" size={20} color="#cc9e6f" />
                      </View>
                      <Text style={{ color: '#1c1f0f', fontWeight: '700', fontSize: 20 }}>Descrição</Text>
                    </View>
                    <Text style={{ color: '#707b55', fontSize: 17, lineHeight: 26 }}>
                      {expandedDrink.description}
                    </Text>
                  </View>
                )}

                {/* Botões: Adicionar + Minimizar */}
                <TouchableOpacity
                  onPress={() => {
                    addDrink(expandedDrink);
                    setExpandedDrink(null);
                  }}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#78a764',
                    marginTop: 28,
                    paddingVertical: 18,
                    borderRadius: 16,
                    gap: 8,
                    shadowColor: '#78a764',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  <Ionicons name="add-circle-outline" size={22} color="#FFF" />
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 17 }}>Adicionar ao Pedido</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setExpandedDrink(null)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#1c1f0f',
                    marginTop: 10,
                    paddingVertical: 18,
                    borderRadius: 16,
                    gap: 8,
                  }}
                >
                  <Ionicons name="chevron-down-outline" size={22} color="#cc9e6f" />
                  <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 17 }}>Minimizar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}