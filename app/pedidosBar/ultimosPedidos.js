import React, { useEffect, useState, useRef } from 'react';
import {
  FlatList,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { app } from '../src/config/firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { useAppStore } from '../src/store/useAppStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

export default function UltimosPedidosScreen() {
  const [rawOrders, setRawOrders] = useState([]);
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [offlineStatusUpdates, setOfflineStatusUpdates] = useState({});
  const [recentProntos, setRecentProntos] = useState({});
  const [takeoverOrder, setTakeoverOrder] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const router = useRouter();
  const isOffline = useNetworkStore(s => s.isOffline);
  const offlineQueueCount = useNetworkStore(s => s.offlineQueueCount);
  const festaSelecionada = useAppStore(s => s.festaSelecionada);

  // Monitora a fila offline para exibir os pedidos não sincronizados
  useEffect(() => {
    const fetchQueue = async () => {
      const { getOfflineQueue } = require('../src/services/offlineQueue');
      const queue = await getOfflineQueue();
      const formatted = queue.map((o, idx) => ({ 
        id: `offline-${idx}-${Date.now()}`, 
        ...o, 
        isOfflineSync: true,
        status: o.status || 'pendente'
      }));
      setOfflineOrders(formatted);

      const { getStatusUpdatesQueue } = require('../src/services/offlineQueue');
      const statusUpdates = await getStatusUpdatesQueue();
      setOfflineStatusUpdates(statusUpdates);
    };
    fetchQueue();
  }, [offlineQueueCount]);

  useEffect(() => {
    const loadCache = async () => {
      const cachedOrders = await getCachedData(CACHE_KEYS.PEDIDOS, []);
      const cachedClients = await getCachedData(CACHE_KEYS.CLIENTES, {});
      
      if (cachedOrders.length > 0) {
        const enrichedOrders = cachedOrders.map(order => ({
          ...order,
          clientInfo: (order.clienteId && cachedClients[order.clienteId]) ? cachedClients[order.clienteId] : {}
        }));
        setRawOrders(enrichedOrders);
      }
    };
    loadCache();
  }, []);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    const db = getDatabase(app);
    const ordersRef = ref(db, 'pedidos');

    const unsubscribe = onValue(ordersRef, async (snapshot) => {
      try {
        const data = snapshot.val();
        const ordersList = data
          ? Object.keys(data).map((key) => ({ id: key, ...data[key] }))
          : [];

        const clientsCache = await getCachedData(CACHE_KEYS.CLIENTES, {});

        const enrichedOrders = await Promise.all(
          ordersList.map(async (order) => {
            if (!order.clienteId) return { ...order, clientInfo: {} };

            // Look up client info, try cache first to avoid slow down, though we still fetch from FB if not found.
            if (clientsCache[order.clienteId]) {
              return { ...order, clientInfo: clientsCache[order.clienteId] };
            }

            try {
              const clientRef = ref(db, `clientes/${order.clienteId}`);
              const clientSnapshot = await get(clientRef);
              const clientInfo = clientSnapshot.exists() ? clientSnapshot.val() : {};
              
              if (clientSnapshot.exists()) {
                clientsCache[order.clienteId] = clientInfo;
              }

              return {
                ...order,
                clientInfo: clientInfo,
              };
            } catch (error) {
              console.log('Error fetching client:', error);
              return { ...order, clientInfo: {} };
            }
          })
        );
        
        cacheData(CACHE_KEYS.PEDIDOS, ordersList);
        cacheData(CACHE_KEYS.CLIENTES, clientsCache);

        setRawOrders((prevOrders) => {
          // Skip takeover on first load to avoid alerting for pre-existing 'pronto' orders
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return enrichedOrders;
          }

          const newProntos = {};

          enrichedOrders.forEach((order) => {
            if (
              order.status === 'pronto' &&
              !recentProntos[order.id] &&
              !prevOrders.find((o) => o.id === order.id && o.status === 'pronto')
            ) {
              newProntos[order.id] = true;

              if (order.partyId === festaSelecionada?.id) {
                 setTakeoverOrder(order);
              }

              setTimeout(() => {
                setRecentProntos((prev) => {
                  const updated = { ...prev };
                  delete updated[order.id];
                  return updated;
                });
                setTakeoverOrder(null);
              }, 4000);
            }
          });

          setRecentProntos((prev) => ({ ...prev, ...newProntos }));
          return enrichedOrders;
        });
      } catch (error) {
        console.error('Error fetching orders:', error);
      }
    });

    return () => unsubscribe();
  }, [recentProntos]);

  // Mescla pedidos offline com pedidos normais, eliminando duplicatas por offlineId
  const orders = (() => {
    const rawIds = new Set(rawOrders.map(o => o.offlineId).filter(Boolean));
    const uniqueOffline = offlineOrders.filter(o => !o.offlineId || !rawIds.has(o.offlineId));
    return [...uniqueOffline, ...rawOrders].map(order =>
      offlineStatusUpdates[order.id] ? { ...order, ...offlineStatusUpdates[order.id] } : order
    );
  })();

  const partyId = festaSelecionada?.id || festaSelecionada?.uid;

  const pendingOrdersFull = orders
    .filter((order) => order.status === 'pendente' && (!partyId || order.partyId === partyId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const readyOrdersFull = orders
    .filter((order) => order.status === 'pronto' && (!partyId || order.partyId === partyId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const maxPages = Math.max(1, Math.ceil(Math.max(pendingOrdersFull.length, readyOrdersFull.length) / 5));

  useEffect(() => {
    const timer = setInterval(() => {
       setPageIndex(prev => (prev + 1) % maxPages);
    }, 8000); // Gira a página a cada 8s
    return () => clearInterval(timer);
  }, [maxPages]);

  const pendingOrders = pendingOrdersFull.slice(pageIndex * 5, pageIndex * 5 + 5);
  const readyOrders = readyOrdersFull.slice(pageIndex * 5, pageIndex * 5 + 5);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const totalDrinksInOrder = (drinks) => {
    if (!drinks || !Array.isArray(drinks)) return 0;
    return drinks.reduce((sum, d) => sum + (d.quantity || 0), 0);
  };

  const getMaskedClientString = (item) => {
    let name = item.clientInfo?.name || item.nome || 'Cliente Desconhecido';
    if (name === 'Visitante' && item.numeroPedido) {
        name = `Visitante #${item.numeroPedido}`;
    } else if (item.numeroPedido) {
        name = `#${item.numeroPedido} ${name}`;
    }

    const whats = item.clientInfo?.whatsapp || item.whatsapp;
    if (!whats) return name;
    
    const digits = whats.replace(/\D/g, '');
    if (digits.length >= 4) {
       return `${name} (••${digits.slice(-4)})`;
    }
    return name;
  };

  const renderOrder = (status) => ({ item, index }) => {
    const isPulsing = status === 'pronto' && recentProntos[item.id];
    const isReady = status === 'ready';
    const accentColor = isReady ? '#78a764' : '#cc9e6f';
    const totalDrinks = totalDrinksInOrder(item.drinks);

    return (
      <Animated.View entering={FadeInUp.duration(400).delay(index * 80)}>
        <View style={[
          styles.orderCard,
          isReady ? styles.readyCard : styles.pendingCard,
          isPulsing && styles.pulsingCard,
        ]}>
          {/* Header do card */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{
                backgroundColor: isReady ? '#78a764' : '#1c1f0f',
                borderRadius: 14,
                padding: 10,
              }}>
                <Ionicons
                  name={isReady ? "checkmark-circle" : "time-outline"}
                  size={22}
                  color={isReady ? '#FFF' : '#cc9e6f'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName} numberOfLines={1}>
                  {getMaskedClientString(item)}
                </Text>
                {item.timestamp && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="time-outline" size={12} color="#707b55" />
                    <Text style={{ color: '#707b55', fontSize: 12, fontWeight: '500' }}>
                      {formatTime(item.timestamp)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {item.isOfflineSync && (
                <View style={{
                  backgroundColor: '#1c1f0f',
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 5,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Ionicons name="cloud-offline" size={14} color="#cc9e6f" />
                </View>
              )}
              <View style={{
                backgroundColor: isReady ? 'rgba(120, 167, 100, 0.15)' : 'rgba(204, 158, 111, 0.15)',
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}>
                <Text style={{
                  color: accentColor,
                  fontSize: 13,
                  fontWeight: '700',
                }}>
                  {isReady ? '✓ Pronto' : '⏳ Pendente'}
                </Text>
              </View>
            </View>
          </View>

          {/* Drinks */}
          {item.drinks && Array.isArray(item.drinks) && item.drinks.length > 0 ? (
            <View style={{
              backgroundColor: '#F5F0EA',
              borderRadius: 14,
              padding: 14,
            }}>
              {item.drinks.map((drink, idx) => (
                <View key={idx} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: idx < item.drinks.length - 1 ? 10 : 0,
                }}>
                  <View style={{
                    backgroundColor: 'rgba(120, 167, 100, 0.15)',
                    borderRadius: 10,
                    padding: 6,
                  }}>
                    <Ionicons name="wine-outline" size={16} color="#78a764" />
                  </View>
                  <Text style={styles.drinkText} numberOfLines={1}>
                    {drink.drinkName || 'Bebida'}
                  </Text>
                  <View style={{
                    backgroundColor: accentColor,
                    borderRadius: 8,
                    minWidth: 28,
                    height: 28,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 6,
                  }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                      {drink.quantity || 0}
                    </Text>
                  </View>
                </View>
              ))}

              {/* Total */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                marginTop: 10,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: '#e8e4de',
                gap: 6,
              }}>
                <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600' }}>Total:</Text>
                <View style={{
                  backgroundColor: '#1c1f0f',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}>
                  <Text style={{ color: '#cc9e6f', fontSize: 14, fontWeight: '800' }}>
                    {totalDrinks} {totalDrinks === 1 ? 'drink' : 'drinks'}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Text style={styles.noDrinksText}>Nenhuma bebida</Text>
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  const SectionHeader = ({ title, icon, count, color }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: `${color}30`,
    }}>
      <View style={{ backgroundColor: color, borderRadius: 14, padding: 10 }}>
        <Ionicons name={icon} size={22} color="#FFF" />
      </View>
      <Text style={styles.columnTitle}>{title}</Text>
      <View style={{
        backgroundColor: `${color}20`,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1.5,
        borderColor: `${color}40`,
      }}>
        <Text style={{ color, fontSize: 16, fontWeight: '800' }}>{count}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      {/* Header */}
      <Animated.View entering={FadeInUp.duration(500)}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <View style={{ backgroundColor: '#1c1f0f', borderRadius: 18, padding: 14 }}>
              <Ionicons name="list-outline" size={26} color="#cc9e6f" />
            </View>
            <View>
              <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '800' }}>
                Últimos Pedidos
              </Text>
              <Text style={{ color: '#707b55', fontSize: 14, marginTop: 2 }}>
                {pendingOrdersFull.length + readyOrdersFull.length} pedido{(pendingOrdersFull.length + readyOrdersFull.length) !== 1 ? 's' : ''} no total
                {isOffline ? ' (cache local)' : ''}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.columnsContainer}>
          {/* Pending Orders */}
          <View style={styles.column}>
            <SectionHeader title="Pendentes" icon="time-outline" count={pendingOrders.length} color="#cc9e6f" />
            <FlatList
              data={pendingOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrder('pending')}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', borderRadius: 40, padding: 18, marginBottom: 10 }}>
                    <Ionicons name="checkmark-circle-outline" size={36} color="#cc9e6f" />
                  </View>
                  <Text style={styles.emptyTitle}>Tudo em dia!</Text>
                  <Text style={styles.emptySubtitle}>Nenhum pedido pendente</Text>
                </View>
              }
            />
          </View>

          {/* Ready Orders */}
          <View style={styles.column}>
            <SectionHeader title="Prontos" icon="checkmark-circle" count={readyOrders.length} color="#78a764" />
            <FlatList
              data={readyOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrder('ready')}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.1)', borderRadius: 40, padding: 18, marginBottom: 10 }}>
                    <Ionicons name="hourglass-outline" size={36} color="#78a764" />
                  </View>
                  <Text style={styles.emptyTitle}>Aguardando...</Text>
                  <Text style={styles.emptySubtitle}>Nenhum pedido pronto</Text>
                </View>
              }
            />
          </View>
        </View>
      </ScrollView>

      {/* FAB - Retorna para Totem Principal */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/')}
        activeOpacity={0.85}
      >
        <Ionicons name="cart-outline" size={24} color="#cc9e6f" />
        <Text style={styles.fabText}>Fazer Pedido</Text>
      </TouchableOpacity>
      
      {/* TAKEOVER DE TELA INTEIRA (FLASH) */}
      {takeoverOrder && (
        <Animated.View 
          entering={FadeInUp.duration(300).springify()}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: '#78a764', zIndex: 9999, justifyContent: 'center', alignItems: 'center', padding: 24 }]}
        >
           <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 32, borderRadius: 100, marginBottom: 30 }}>
             <Ionicons name="checkmark-done-circle" size={120} color="#FFF" />
           </View>
           
           <Text style={{ color: '#FFF', fontSize: 36, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', marginBottom: 16 }}>
             {getMaskedClientString(takeoverOrder).toUpperCase()},
           </Text>
           <Text style={{ color: '#FFF', fontSize: 38, fontWeight: '900', textAlign: 'center', lineHeight: 46 }}>
             SEU PEDIDO ESTÁ PRONTO!
           </Text>
           <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 20, fontWeight: '600', marginTop: 40, textAlign: 'center' }}>
             (Retire no balcão)
           </Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F0EA',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 12,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    marginHorizontal: 6,
  },
  columnTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1c1f0f',
    flex: 1,
  },
  orderCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  pendingCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#c8cac6',
  },
  readyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#78a764',
  },
  pulsingCard: {
    backgroundColor: 'rgba(120, 167, 100, 0.06)',
    borderColor: '#78a764',
    borderWidth: 2,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1c1f0f',
  },
  drinkText: {
    fontSize: 15,
    color: '#1c1f0f',
    fontWeight: '500',
    flex: 1,
  },
  noDrinksText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#c8cac6',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyTitle: {
    color: '#1c1f0f',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#707b55',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#1c1f0f',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    gap: 8,
    shadowColor: '#1c1f0f',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  fabText: {
    color: '#cc9e6f',
    fontWeight: '700',
    fontSize: 17,
  },
});