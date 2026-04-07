import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Platform, ScrollView, Modal, Switch } from 'react-native';
import { getDatabase, ref, onValue, update, get } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn, FadeOut } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import '../../global.css';
import { SafeAreaView } from 'react-native-safe-area-context';
import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { useAppStore } from '../src/store/useAppStore';
import { withTimeout } from '../src/utils/firebaseHelpers';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { enqueueDrinkUpdate } from '../src/services/offlineQueue';
import { setOnOrderReceived, isServerRunning, startLocalServer } from '../src/services/localServer';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function GerenciarPedidosScreen() {
  const [rawOrders, setRawOrders] = useState([]);
  const [clientsCache, setClientsCache] = useState({});
  const [filter, setFilter] = useState('pendente');
  const [isProcessing, setIsProcessing] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const db = getDatabase(app);
  const isOffline = useNetworkStore(s => s.isOffline);
  const offlineQueueCount = useNetworkStore(s => s.offlineQueueCount);
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [offlineStatusUpdates, setOfflineStatusUpdates] = useState({});
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [drinksCatalog, setDrinksCatalog] = useState([]);
  const [activeParties, setActiveParties] = useState([]);

  // Estado do banner de alerta de estoque
  const [stockAlerts, setStockAlerts] = useState([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [stockData, setStockData] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState({});
  const party = useAppStore(s => s.festaSelecionada);
  const rotationTimer = useRef(null);
  const cacheLoaded = useRef(false);
  const [toast, setToast] = useState(null);
  const [p2pOrderCount, setP2pOrderCount] = useState(0); // contador visual de pedidos P2P recebidos

  // Listener P2P: se este tablet for o Servidor Barista, recebe pedidos locais
  useEffect(() => {
    const initP2P = async () => {
      const isServer = await AsyncStorage.getItem('@barman_is_server');
      if (isServer === 'true') {
        // Reativa o servidor caso o app tenha reiniciado
        if (!isServerRunning()) {
          startLocalServer(8080);
        }
        // Registra callback para quando chegar pedido P2P
        setOnOrderReceived((order) => {
          setP2pOrderCount(prev => prev + 1);
          // Injeta o pedido P2P junto com os pedidos normais
          const p2pEntry = {
            id: `p2p-${Date.now()}`,
            ...order,
            isP2P: true,
            status: 'pendente'
          };
          setRawOrders(prev => {
            const updated = [p2pEntry, ...prev];
            // Persiste P2P no cache para sobreviver reinícios
            cacheData(CACHE_KEYS.PEDIDOS, updated);
            return updated;
          });
          showToast('📡 Pedido P2P', `Totem enviou pedido pela rede local!`, 'warning');
        });
      }
    };
    initP2P();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Carrega cache na montagem para garantir que offline sempre tenha dados
  useEffect(() => {
    const loadCache = async () => {
      const cachedOrders = await getCachedData(CACHE_KEYS.PEDIDOS, []);
      const cachedClients = await getCachedData(CACHE_KEYS.CLIENTES, {});
      const cachedDrinks = await getCachedData(CACHE_KEYS.DRINKS_CATALOG, []);
      const cachedEstoque = await getCachedData(CACHE_KEYS.ESTOQUE, {});
      const cachedDismissed = await getCachedData(CACHE_KEYS.DISMISSED_ALERTS, {});
      const cachedFestas = await getCachedData(CACHE_KEYS.FESTAS, []);

      if (cachedOrders.length > 0) setRawOrders(cachedOrders);
      if (Object.keys(cachedClients).length > 0) setClientsCache(cachedClients);
      if (cachedDrinks.length > 0) setDrinksCatalog(cachedDrinks);
      if (Object.keys(cachedEstoque).length > 0) setStockData(cachedEstoque);
      if (Object.keys(cachedDismissed).length > 0) setDismissedAlerts(cachedDismissed);
      if (cachedFestas.length > 0) setActiveParties(cachedFestas);
      cacheLoaded.current = true;
    };
    loadCache();
  }, []);

  useEffect(() => {
    const configRef = ref(db, 'config/whatsapp');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setWhatsappConfig(snapshot.val());
      }
    });
    return () => unsubscribeConfig();
  }, []);

  useEffect(() => {
    const clientsRef = ref(db, 'clientes');
    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setClientsCache(data);
        cacheData(CACHE_KEYS.CLIENTES, data);
      }
    });
    return () => unsubscribeClients();
  }, []);

  useEffect(() => {
    const ordersRef = ref(db, 'pedidos');
    const unsubscribeOrders = onValue(
      ordersRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const ordersList = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
          setRawOrders(ordersList);
          cacheData(CACHE_KEYS.PEDIDOS, ordersList);
        } else if (!isOffline) {
          // Só zera se realmente estiver online (significa que não há pedidos no Firebase)
          setRawOrders([]);
          cacheData(CACHE_KEYS.PEDIDOS, []);
        }
        // Se offline e data=null, mantém os dados do cache carregados na montagem
      },
      (error) => {
        // Offline: não mostra erros de rede, dados já estão no cache
        if (!isOffline) {
          if (Platform.OS === 'web') window.alert('Erro: Falha ao carregar pedidos: ' + error.message);
          else Alert.alert('Erro', 'Falha ao carregar pedidos: ' + error.message);
        }
      }
    );
    return () => unsubscribeOrders();
  }, [isOffline]);

  useEffect(() => {
    const drinksRef = ref(db, 'drinks');
    const unsubscribeDrinks = onValue(drinksRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const catalog = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
        setDrinksCatalog(catalog);
        cacheData(CACHE_KEYS.DRINKS_CATALOG, catalog);
      } else if (!isOffline) {
        // Só zera se online de verdade
        setDrinksCatalog([]);
      }
    });
    return () => unsubscribeDrinks();
  }, [isOffline]);

  useEffect(() => {
    const festasRef = ref(db, 'festas');
    const unsubscribeFestas = onValue(festasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const activeIds = Object.keys(data).filter(key => data[key].status === 'ativa');
        setActiveParties(activeIds);
        cacheData(CACHE_KEYS.FESTAS, activeIds);
      } else if (!isOffline) {
        setActiveParties([]);
        cacheData(CACHE_KEYS.FESTAS, []);
      }
      // Se offline e snapshot vazio, mantém os activeParties do cache
    });
    return () => unsubscribeFestas();
  }, [isOffline]);

  // ---- MONITORAMENTO DE ESTOQUE EM TEMPO REAL ----
  useEffect(() => {
    const partyId = party?.uid || party?.id;
    if (!partyId) return;

    const estoqueRef = ref(db, `festas/${partyId}/estoque`);
    const unsubscribe = onValue(estoqueRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setStockData(data);
        cacheData(CACHE_KEYS.ESTOQUE, data);
      } else {
        setStockData({});
      }
    });
    return () => unsubscribe();
  }, [party]);

  // Gera alertas sempre que stockData mudar (funciona com dados do Firebase OU do cache)
  useEffect(() => {
    if (Object.keys(stockData).length === 0) {
      setStockAlerts([]);
      return;
    }
    const alerts = Object.keys(stockData).map(key => {
      const item = stockData[key];
      const perc = (item.quantidadeAtual / item.quantidadeInicial) * 100;
      let level = 'green';
      let color = '#78a764';
      let bgColor = 'rgba(120, 167, 100, 0.12)';
      let icon = 'checkmark-circle';
      if (perc <= 20) {
        level = 'red'; color = '#c83c3c'; bgColor = 'rgba(200, 60, 60, 0.12)'; icon = 'alert-circle';
      } else if (perc <= 50) {
        level = 'yellow'; color = '#d4a017'; bgColor = 'rgba(212, 160, 23, 0.12)'; icon = 'warning';
      }
      return {
        id: key,
        nome: item.nome,
        atual: parseFloat(item.quantidadeAtual).toFixed(0),
        inicial: item.quantidadeInicial,
        unidade: item.unidade,
        perc: Math.max(0, Math.round(perc)),
        level,
        color,
        bgColor,
        icon,
      };
    })
      .filter(a => a.perc < 100)
      .sort((a, b) => a.perc - b.perc);
    setStockAlerts(alerts);
  }, [stockData]);

  // Rotação automática do banner de alertas
  useEffect(() => {
    if (stockAlerts.length <= 1) return;
    rotationTimer.current = setInterval(() => {
      setCurrentAlertIndex(prev => (prev + 1) % stockAlerts.length);
    }, 3000);
    return () => clearInterval(rotationTimer.current);
  }, [stockAlerts.length]);

  // Calcula o status de estoque de um drink baseado na ficha técnica
  const getDrinkStockStatus = (drink) => {
    if (!drink.fichaTecnica || drink.fichaTecnica.length === 0 || Object.keys(stockData).length === 0) {
      return { level: 'none', alertItems: [] };
    }
    let worstLevel = 'green';
    const alertItems = [];
    for (const ficha of drink.fichaTecnica) {
      const insumoId = ficha.insumoId;
      if (!insumoId) continue;
      const estoqueItem = stockData[insumoId];
      if (!estoqueItem) continue;
      const perc = (estoqueItem.quantidadeAtual / estoqueItem.quantidadeInicial) * 100;
      if (perc <= 0) {
        worstLevel = 'red';
        alertItems.push({ nome: estoqueItem.nome, perc: 0, atual: 0, unidade: estoqueItem.unidade, esgotado: true });
      } else if (perc <= 20) {
        if (worstLevel !== 'red') worstLevel = 'red';
        alertItems.push({ nome: estoqueItem.nome, perc: Math.round(perc), atual: parseFloat(estoqueItem.quantidadeAtual).toFixed(0), unidade: estoqueItem.unidade, esgotado: false });
      } else if (perc <= 50) {
        if (worstLevel === 'green') worstLevel = 'yellow';
        alertItems.push({ nome: estoqueItem.nome, perc: Math.round(perc), atual: parseFloat(estoqueItem.quantidadeAtual).toFixed(0), unidade: estoqueItem.unidade, esgotado: false });
      }
    }
    return { level: worstLevel, alertItems };
  };

  // Componente de card do drink com alerta de estoque
  const DrinkStockCard = ({ item, typeColor }) => {
    const status = getDrinkStockStatus(item);
    const hasAlert = status.level === 'yellow' || status.level === 'red';
    const borderAlert = status.level === 'red' ? '#c83c3c' : status.level === 'yellow' ? '#d4a017' : null;

    return (
      <View style={{
        backgroundColor: '#FFF', padding: 14, borderRadius: 14, marginBottom: 8,
        borderWidth: hasAlert ? 2 : 1.5,
        borderColor: hasAlert ? borderAlert : (item.inactive ? 'rgba(200,60,60,0.2)' : 'rgba(120,167,100,0.2)'),
        borderLeftWidth: 4, borderLeftColor: typeColor,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: item.inactive ? '#9e9e9e' : '#1c1f0f', textDecorationLine: item.inactive ? 'line-through' : 'none' }}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.inactive ? '#c83c3c' : '#78a764' }} />
              <Text style={{ fontSize: 11, color: item.inactive ? '#c83c3c' : '#78a764', fontWeight: '700' }}>
                {item.inactive ? 'ESGOTADO' : 'DISPONÍVEL'}
              </Text>
            </View>
          </View>
          <Switch
            value={!item.inactive}
            onValueChange={() => toggleDrinkActive(item)}
            trackColor={{ false: '#ffcdd2', true: '#c8e6c9' }}
            thumbColor={!item.inactive ? '#4caf50' : '#f44336'}
          />
        </View>
        {/* Alertas de ingredientes */}
        {status.alertItems.length > 0 && (
          <View style={{
            marginTop: 8, backgroundColor: status.level === 'red' ? 'rgba(200,60,60,0.06)' : 'rgba(212,160,23,0.06)',
            borderRadius: 10, padding: 8,
          }}>
            {status.alertItems.map((a, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: idx < status.alertItems.length - 1 ? 4 : 0 }}>
                <Ionicons
                  name={a.esgotado ? 'close-circle' : 'warning'}
                  size={14}
                  color={a.esgotado ? '#c83c3c' : '#d4a017'}
                />
                <Text style={{ fontSize: 11, color: a.esgotado ? '#c83c3c' : '#d4a017', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {a.esgotado ? `${a.nome} — ACABOU!` : `${a.nome}: ${a.atual}${a.unidade} (${a.perc}%)`}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const toggleDrinkActive = async (drink) => {
    try {
      const newStatus = !drink.inactive;

      if (isOffline) {
        // Enfileira alteração para quando voltar a rede
        await enqueueDrinkUpdate(drink.id, newStatus);

        // Atualiza a UI imediato
        const updatedCatalog = drinksCatalog.map(d =>
          d.id === drink.id ? { ...d, inactive: newStatus } : d
        );
        setDrinksCatalog(updatedCatalog);

        // Atualiza cache local para persistir enquanto offline
        cacheData(CACHE_KEYS.DRINKS_CATALOG, updatedCatalog);
        return;
      }

      await withTimeout(update(ref(db), { [`drinks/${drink.id}/inactive`]: newStatus }), 3000);
    } catch (e) {
      if (e.message === 'TIMEOUT_FIREBASE') {
        Alert.alert('Modo Offline', 'Rede fraca. Ativação da bebida pausada no momento.');
      } else {
        Alert.alert('Erro', 'Não foi possível alterar a disponibilidade.');
      }
    }
  };

  const mergedOrders = [...offlineOrders, ...rawOrders].map(order =>
    offlineStatusUpdates[order.id] ? { ...order, ...offlineStatusUpdates[order.id] } : order
  );

  // Usa apenas a festa selecionada pelo barista no momento (Zustand),
  // removendo dependência de dados externos para evitar ocultação acidental de pedidos.
  const partyId = party?.id || party?.uid;

  const orders = mergedOrders
    .filter(order => !partyId || order.partyId === partyId)
    .map(order => ({
      ...order,
      clientInfo: (order.clienteId && clientsCache[order.clienteId]) ? clientsCache[order.clienteId] : {}
    }))
    .sort((a, b) => new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp));

  const sendNotification = async (clientData, mensagem, maxRetries = 3) => {
    if (!clientData?.whatsapp) return { success: false, error: "WhatsApp não cadastrado" };

    const cleanPhone = clientData.whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) return { success: false, error: "Número inválido" };

    const phoneNumber = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const url = whatsappConfig?.apiUrl || "https://api.gabryelamaro.com/message/sendText/BarmanJF";
    const key = whatsappConfig?.apiKey || "Suapikeyaqui";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": key, "Accept": "application/json" },
          body: JSON.stringify({ number: phoneNumber, text: mensagem }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            continue;
          }
          return { success: false, error: `Erro HTTP ${response.status}`, attempt };
        }

        let result;
        try { result = JSON.parse(await response.text()); } catch { result = { success: true }; }
        return { success: true, data: result, attempt };
      } catch (error) {
        if ((error.name === 'AbortError' || error.message.includes('fetch')) && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        if (attempt === maxRetries) return { success: false, error: error.message, attempt };
      }
    }
    return { success: false, error: "Máximo de tentativas excedido" };
  };

  const generateStatusMessage = (status, clientName, orderDetails) => {
    const name = clientName || "cliente";
    const drinksList = orderDetails?.drinks?.map(d => `- *${d.quantity}x* ${d.drinkName}`).join('\n') || '- Bebidas do seu pedido';

    const buildMsg = (title, desc) => {
      let msg = `*STATUS DO PEDIDO: ${title}*\n\n`;
      msg += `Olá, *${name}*. ${desc}\n\n`;
      msg += `*RESUMO:*\n${drinksList}\n\n`;
      msg += `_Atenciosamente,_\n*Equipe do Bar*`;
      return msg;
    };

    const messages = {
      pendente: buildMsg('Recebido', 'Recebemos o seu pedido. Ele já está em nossa fila de produção.'),
      'em-preparo': buildMsg('Em Preparo', 'Nossos baristas começaram a preparar suas bebidas neste exato momento.'),
      pronto: buildMsg('Pronto para Retirada', 'Tudo certo. Seu pedido já está montado. Por favor, dirija-se ao balcão para realizar a retirada.'),
      entregue: buildMsg('Entregue', 'Pedido entregue com sucesso. Aproveite o seu drink.'),
      cancelado: buildMsg('Cancelado', 'O seu pedido precisou ser cancelado pelo bar. Caso tenha ocorrido algum engano, por favor verifique presencialmente com a nossa equipe.')
    };

    return messages[status] || `Status atualizado: ${status}`;
  };

  const showToast = (title, msg, type = 'success') => {
    setToast({ title, msg, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const updateOrderStatus = async (orderId, newStatus, clientData, orderDetails) => {
    if (isProcessing) return; // Silent lock instead of alert

    setIsProcessing(true);
    try {
      const updates = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        lastStatusChange: { status: newStatus, timestamp: new Date().toISOString(), updatedBy: 'barista' }
      };

      if (isOffline) {
        if (orderDetails.isOfflineSync) {
          const { updateOfflineQueueOrderStatus } = require('../src/services/offlineQueue');
          await updateOfflineQueueOrderStatus(orderDetails.offlineId, newStatus);
          setOfflineOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
        } else {
          const { enqueueStatusUpdate } = require('../src/services/offlineQueue');
          await enqueueStatusUpdate(orderId, updates);
          setOfflineStatusUpdates(prev => ({ ...prev, [orderId]: updates }));
        }

        const statusDisplay = { pendente: 'Pendente', pronto: 'Pronto', cancelado: 'Cancelado', 'em-preparo': 'Em Preparo', entregue: 'Entregue' }[newStatus] || newStatus;
        showToast('Salvo Localmente ☁️', `Pedido ${statusDisplay}.`);
      } else {
        await withTimeout(update(ref(db), {
          [`pedidos/${orderId}/status`]: newStatus,
          [`pedidos/${orderId}/updatedAt`]: updates.updatedAt,
          [`pedidos/${orderId}/lastStatusChange`]: updates.lastStatusChange
        }), 3000);
        const mensagem = generateStatusMessage(newStatus, clientData?.name, orderDetails);
        const notificationSent = await sendNotification(clientData, mensagem);
        const statusDisplay = { pendente: 'Pendente', pronto: 'Pronto', cancelado: 'Cancelado', 'em-preparo': 'Em Preparo', entregue: 'Entregue' }[newStatus] || newStatus;

        if (notificationSent?.success) {
          showToast('Notificado 🎉', `Pedido → "${statusDisplay}" e mensagem enviada!`);
        } else if (clientData?.whatsapp) {
          showToast('Aviso ⚠️', `Pedido → "${statusDisplay}". Falha na notificação.`, 'warning');
        } else {
          showToast('Atualizado ✅', `Pedido → "${statusDisplay}" (Sem Whatsapp)`);
        }
      }
    } catch (error) {
      showToast('Erro ❌', error.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    updateOrderStatus(order.id, newStatus, order.clientInfo, order);
  };

  const getStatusConfig = (status) => {
    const configs = {
      pendente: { color: '#cc9e6f', bg: 'rgba(204, 158, 111, 0.12)', icon: 'time-outline', label: 'Pendente' },
      'em-preparo': { color: '#707b55', bg: 'rgba(112, 123, 85, 0.12)', icon: 'restaurant-outline', label: 'Em Preparo' },
      pronto: { color: '#78a764', bg: 'rgba(120, 167, 100, 0.12)', icon: 'checkmark-circle', label: 'Pronto' },
      entregue: { color: '#78a764', bg: 'rgba(120, 167, 100, 0.12)', icon: 'gift-outline', label: 'Entregue' },
      cancelado: { color: '#c83c3c', bg: 'rgba(200, 60, 60, 0.08)', icon: 'close-circle', label: 'Cancelado' },
    };
    return configs[status] || { color: '#c8cac6', bg: 'rgba(200, 202, 198, 0.12)', icon: 'help-outline', label: status };
  };

  const filteredOrders = orders.filter((order) => filter === 'all' ? true : order.status === filter);

  const renderOrder = ({ item, index }) => {
    const sc = getStatusConfig(item.status);

    const renderRightActions = () => {
      if (item.status === 'cancelado' || item.status === 'entregue') {
        return (
          <TouchableOpacity
            onPress={() => handleStatusChange(item, 'pendente')}
            style={{ backgroundColor: '#a0a29f', justifyContent: 'center', alignItems: 'center', width: 90, borderRadius: 18, marginBottom: 12, marginLeft: 10 }}
          >
            <Ionicons name="arrow-undo-outline" size={28} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '800', marginTop: 4, fontSize: 13 }}>Voltar</Text>
          </TouchableOpacity>
        );
      }

      return (
        <View style={{ flexDirection: 'row' }}>
          {item.status === 'pendente' && (
            <>
              <TouchableOpacity
                onPress={() => handleStatusChange(item, 'em-preparo')}
                style={{ backgroundColor: '#cc9e6f', justifyContent: 'center', alignItems: 'center', width: 85, borderRadius: 18, marginBottom: 12, marginLeft: 10 }}
              >
                <Ionicons name="restaurant-outline" size={28} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', marginTop: 4, fontSize: 13 }}>Iniciar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleStatusChange(item, 'pronto')}
                style={{ backgroundColor: '#78a764', justifyContent: 'center', alignItems: 'center', width: 85, borderRadius: 18, marginBottom: 12, marginLeft: 10 }}
              >
                <Ionicons name="flash-outline" size={28} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '800', marginTop: 4, fontSize: 13, textAlign: 'center' }}>Pronto</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status === 'em-preparo' && (
            <TouchableOpacity
              onPress={() => handleStatusChange(item, 'pronto')}
              style={{ backgroundColor: '#78a764', justifyContent: 'center', alignItems: 'center', width: 100, borderRadius: 18, marginBottom: 12, marginLeft: 10 }}
            >
              <Ionicons name="checkmark-circle-outline" size={32} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '800', marginTop: 4 }}>Pronto</Text>
            </TouchableOpacity>
          )}

          {item.status === 'pronto' && (
            <TouchableOpacity
              onPress={() => handleStatusChange(item, 'entregue')}
              style={{ backgroundColor: '#1c1f0f', justifyContent: 'center', alignItems: 'center', width: 100, borderRadius: 18, marginBottom: 12, marginLeft: 10 }}
            >
              <Ionicons name="gift-outline" size={32} color="#cc9e6f" />
              <Text style={{ color: '#cc9e6f', fontWeight: '800', marginTop: 4 }}>Entregar</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    };

    const renderLeftActions = () => {
      if (item.status === 'cancelado' || item.status === 'entregue') return null;

      return (
        <TouchableOpacity
          onPress={() => handleStatusChange(item, 'cancelado')}
          style={{
            backgroundColor: '#c83c3c',
            justifyContent: 'center',
            alignItems: 'center',
            width: 100,
            borderRadius: 18,
            marginBottom: 12,
            marginRight: 10,
          }}
        >
          <Ionicons name="close-circle-outline" size={32} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '800', marginTop: 4 }}>Cancelar</Text>
        </TouchableOpacity>
      );
    };

    return (
      <Animated.View entering={FadeInUp.duration(400).delay(index * 50)}>
        <Swipeable
          renderRightActions={renderRightActions}
          renderLeftActions={renderLeftActions}
          overshootRight={false}
          overshootLeft={false}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 24,
              marginBottom: 12,
              borderWidth: 1.5,
              borderColor: '#e8e5e1',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.04,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            {/* Bebidas - O Foco Absoluto */}
            <View style={{ marginBottom: 16 }}>
              {item.drinks && Array.isArray(item.drinks) && item.drinks.length > 0 ? (
                item.drinks.map((drink, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: idx < item.drinks.length - 1 ? 16 : 0 }}>
                    <View style={{ backgroundColor: '#1c1f0f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: '#cc9e6f', fontSize: 18, fontWeight: '900' }}>×{drink.quantity || 0}</Text>
                    </View>
                    <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '900', flex: 1, textTransform: 'uppercase' }}>
                      {drink.drinkName || 'Desconhecido'}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#c8cac6', fontSize: 16, fontStyle: 'italic', fontWeight: 'bold' }}>Nenhuma bebida</Text>
              )}
            </View>

            {/* Rodapé do Card - Informações Complementares e Status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f0ede9', paddingTop: 16 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: '#707b55', fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                    {item.numeroPedido ? `#${item.numeroPedido} - ` : ''}{item.clientInfo?.name || item.nome || 'Desconhecido'}
                  </Text>
                  {item.source === 'vip' && <Ionicons name="star" size={14} color="#d4a017" />}
                  {item.isP2P && (
                    <View style={{ backgroundColor: 'rgba(91, 155, 213, 0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="wifi" size={10} color="#5b9bd5" />
                      <Text style={{ color: '#5b9bd5', fontSize: 9, fontWeight: '800' }}>P2P</Text>
                    </View>
                  )}
                  {item.isOfflineSync && (
                    <View style={{ backgroundColor: 'rgba(212, 160, 23, 0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="cloud-offline-outline" size={10} color="#d4a017" />
                      <Text style={{ color: '#d4a017', fontSize: 9, fontWeight: '800' }}>OFFLINE</Text>
                    </View>
                  )}
                </View>
                {item.updatedAt && (
                  <Text style={{ color: '#c8cac6', fontSize: 11, marginTop: 2 }}>
                    Atualizado: {new Date(item.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>

              <View style={{ backgroundColor: sc.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={sc.icon} size={16} color={sc.color} />
                <Text style={{ color: sc.color, fontSize: 14, fontWeight: '800' }}>{sc.label}</Text>
              </View>
            </View>
          </View>
        </Swipeable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      {toast && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          exiting={FadeOut.duration(300)}
          style={{
            position: 'absolute', top: 50, left: 16, right: 16, zIndex: 999,
            backgroundColor: toast.type === 'error' ? '#c83c3c' : (toast.type === 'warning' ? '#d4a017' : '#1c1f0f'),
            borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6
          }}
        >
          <Ionicons name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={24} color="#FFF" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>{toast.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}

      <OfflineBanner />

      {/* ---- MINI BANNER DE ALERTA DE ESTOQUE ---- */}
      {(() => {
        // Filtra alertas já dispensados (só volta se piorou de nível)
        const visibleAlerts = stockAlerts.filter(a => {
          const dismissed = dismissedAlerts[a.id];
          if (!dismissed) return true;
          // Se piorou (ex: era yellow e agora é red), mostra de novo
          const levelOrder = { green: 0, yellow: 1, red: 2 };
          return (levelOrder[a.level] || 0) > (levelOrder[dismissed] || 0);
        });

        if (visibleAlerts.length === 0) return null;
        const safeIndex = currentAlertIndex % visibleAlerts.length;
        const alert = visibleAlerts[safeIndex] || visibleAlerts[0];

        const handleDismiss = () => {
          Alert.alert(
            '✅ Dispensar Alerta',
            `Deseja dispensar o alerta de "${alert.nome}"?\n\nEle só voltará se o nível piorar.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Dispensar',
                style: 'destructive',
                onPress: () => {
                  const updated = { ...dismissedAlerts, [alert.id]: alert.level };
                  setDismissedAlerts(updated);
                  cacheData(CACHE_KEYS.DISMISSED_ALERTS, updated);
                  if (safeIndex >= visibleAlerts.length - 1) {
                    setCurrentAlertIndex(0);
                  }
                }
              }
            ]
          );
        };

        return (
          <Animated.View entering={FadeIn.duration(300)} key={alert.id + '-' + safeIndex}>
            <View
              style={{
                marginHorizontal: 16,
                marginTop: 4,
                marginBottom: 4,
                backgroundColor: alert.bgColor,
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: alert.color + '30',
              }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setCurrentAlertIndex(prev => (prev + 1) % visibleAlerts.length)}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
              >
                <Ionicons name={alert.icon} size={20} color={alert.color} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: alert.color, fontWeight: '800', fontSize: 13 }} numberOfLines={1}>
                    {alert.nome}
                  </Text>
                  <Text style={{ color: alert.color, fontSize: 11, fontWeight: '600', opacity: 0.8 }}>
                    {alert.atual}{alert.unidade} restante — {alert.perc}% do estoque
                  </Text>
                </View>
                {/* Barra de progresso mini */}
                <View style={{ width: 36, height: 6, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, marginLeft: 6 }}>
                  <View style={{ width: `${Math.min(100, alert.perc)}%`, height: '100%', backgroundColor: alert.color, borderRadius: 3 }} />
                </View>
                {visibleAlerts.length > 1 && (
                  <Text style={{ color: alert.color, fontSize: 10, fontWeight: '700', marginLeft: 6, opacity: 0.7 }}>
                    {safeIndex + 1}/{visibleAlerts.length}
                  </Text>
                )}
              </TouchableOpacity>
              {/* Botão dispensar */}
              <TouchableOpacity
                onPress={handleDismiss}
                activeOpacity={0.6}
                style={{
                  marginLeft: 8,
                  backgroundColor: alert.color + '20',
                  borderRadius: 10,
                  padding: 6,
                }}
              >
                <Ionicons name="close" size={16} color={alert.color} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        );
      })()}

      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 8, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.12)', borderRadius: 14, padding: 10 }}>
                <Ionicons name="receipt-outline" size={22} color="#cc9e6f" />
              </View>
              <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '700' }}>Pedidos</Text>
            </View>
            <TouchableOpacity onPress={() => setCatalogVisible(true)} style={{ backgroundColor: '#1c1f0f', borderRadius: 12, padding: 10 }}>
              <Ionicons name="options-outline" size={22} color="#cc9e6f" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Filtros em Abas de Fácil Acesso (Thumb Zone) */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <View style={{ marginBottom: 16 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 2, gap: 8 }}
            >
              {[
                { key: 'pendente', label: 'Pendente' },
                { key: 'em-preparo', label: 'Preparo' },
                { key: 'pronto', label: 'Pronto' },
                { key: 'entregue', label: 'Entregues' },
                { key: 'cancelado', label: 'Cancelados' },
                { key: 'all', label: 'Todos' }
              ].map((status) => (
                <TouchableOpacity
                  key={status.key}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                    setFilter(status.key);
                  }}
                  activeOpacity={0.85}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 16,
                    backgroundColor: filter === status.key ? '#1c1f0f' : '#FFFFFF',
                    borderWidth: filter === status.key ? 0 : 1.5,
                    borderColor: '#e8e5e1',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{
                    color: filter === status.key ? '#cc9e6f' : '#707b55',
                    fontSize: 15,
                    fontWeight: '800',
                  }}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Animated.View>

        {/* Contador */}
        <Animated.View entering={FadeInUp.duration(500).delay(150)}>
          <Text style={{ color: '#707b55', fontSize: 13, marginBottom: 12, textAlign: 'center', fontWeight: 'bold' }}>
            {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''} {filter === 'all' ? 'no total' : `"${filter}"`}
            {isOffline ? ' (offline cache)' : ''}
          </Text>
        </Animated.View>

        {/* Lista */}
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center', paddingTop: 40 }}>
              <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', borderRadius: 50, padding: 20, marginBottom: 12 }}>
                <Ionicons name="receipt-outline" size={36} color="#cc9e6f" />
              </View>
              <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '500' }}>Nenhum pedido encontrado</Text>
              <Text style={{ color: '#707b55', fontSize: 13, marginTop: 4 }}>Ajuste o filtro para ver outros pedidos</Text>
            </Animated.View>
          }
          refreshing={isProcessing}
        />
      </View>

      {/* ---- MODAL CORTA BEBIDAS (ENGRENAGEM) ---- */}
      <Modal visible={catalogVisible} transparent animationType="slide" onRequestClose={() => setCatalogVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(28, 31, 15, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#F5F0EA', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#1c1f0f' }}>Corta Bebidas ⚡</Text>
                <Text style={{ fontSize: 13, color: '#707b55', marginTop: 2 }}>Desligue o que acabou no bar</Text>
              </View>
              <TouchableOpacity onPress={() => setCatalogVisible(false)}>
                <Ionicons name="close-circle" size={32} color="#c8cac6" />
              </TouchableOpacity>
            </View>

            {/* Legenda de cores */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#78a764' }} />
                <Text style={{ fontSize: 11, color: '#707b55', fontWeight: '600' }}>Disponível</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#c83c3c' }} />
                <Text style={{ fontSize: 11, color: '#707b55', fontWeight: '600' }}>Esgotado</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#cc9e6f' }} />
                <Text style={{ fontSize: 11, color: '#707b55', fontWeight: '600' }}>Alcoólico</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#5b9bd5' }} />
                <Text style={{ fontSize: 11, color: '#707b55', fontWeight: '600' }}>Sem Álcool</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={true}>
              {/* ---- Seção Alcoólicos ---- */}
              {drinksCatalog.filter(d => d.type === 'alcoholic').length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.15)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="wine" size={16} color="#cc9e6f" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1c1f0f' }}>Alcoólicos</Text>
                    <View style={{ backgroundColor: '#cc9e6f', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {drinksCatalog.filter(d => d.type === 'alcoholic').length}
                      </Text>
                    </View>
                  </View>
                  {drinksCatalog.filter(d => d.type === 'alcoholic').map(item => (
                    <DrinkStockCard key={item.id} item={item} typeColor="#cc9e6f" />
                  ))}
                </View>
              )}

              {/* ---- Seção Sem Álcool ---- */}
              {drinksCatalog.filter(d => d.type === 'non-alcoholic').length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={{ backgroundColor: 'rgba(91, 155, 213, 0.15)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="water" size={16} color="#5b9bd5" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1c1f0f' }}>Sem Álcool</Text>
                    <View style={{ backgroundColor: '#5b9bd5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {drinksCatalog.filter(d => d.type === 'non-alcoholic').length}
                      </Text>
                    </View>
                  </View>
                  {drinksCatalog.filter(d => d.type === 'non-alcoholic').map(item => (
                    <DrinkStockCard key={item.id} item={item} typeColor="#5b9bd5" />
                  ))}
                </View>
              )}

              {/* ---- Sem tipo definido ---- */}
              {drinksCatalog.filter(d => d.type !== 'alcoholic' && d.type !== 'non-alcoholic').length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <View style={{ backgroundColor: 'rgba(200, 202, 198, 0.2)', borderRadius: 8, padding: 6 }}>
                      <Ionicons name="help-circle" size={16} color="#a0a29f" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1c1f0f' }}>Outros</Text>
                  </View>
                  {drinksCatalog.filter(d => d.type !== 'alcoholic' && d.type !== 'non-alcoholic').map(item => (
                    <DrinkStockCard key={item.id} item={item} typeColor="#a0a29f" />
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}