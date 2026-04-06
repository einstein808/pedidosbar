import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { db } from '../config/firebaseConfig';
import { push, ref, get, set } from 'firebase/database';

const OFFLINE_QUEUE_KEY = '@barman_offline_orders';
const STATUS_QUEUE_KEY = '@barman_status_updates';
const DRINKS_UPDATE_KEY = '@barman_drinks_updates';

let isSyncing = false;

// Salva um pedido formatado na fila do AsyncStorage
export const enqueueOfflineOrder = async (pedido) => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];
    
    // Podemos adicionar uma tag indicando que foi feito offline
    const pedidoOffline = { ...pedido, isOffline: true };
    queue.push(pedidoOffline);
    
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Pedido de ${pedido.nome || 'Cliente'} adicionado à fila. Total: ${queue.length}`);
  } catch (error) {
    console.error('[OfflineQueue] Erro ao enfileirar pedido:', error);
  }
};

// Retorna todos os pedidos na fila
export const getOfflineQueue = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : [];
  } catch (error) {
    console.error('[OfflineQueue] Erro ao buscar fila:', error);
    return [];
  }
};

// Enfileira atualizações de status na fila
export const enqueueStatusUpdate = async (orderId, updates) => {
  try {
    const queueJson = await AsyncStorage.getItem(STATUS_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : {};
    
    // Sobrescreve atualizações pendentes para o mesmo id com as mais recentes
    queue[orderId] = { ...(queue[orderId] || {}), ...updates };
    
    await AsyncStorage.setItem(STATUS_QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Status Update enfileirado para o pedido: ${orderId}`);
  } catch (error) {
    console.error('[OfflineQueue] Erro ao enfileirar update:', error);
  }
};

export const getStatusUpdatesQueue = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(STATUS_QUEUE_KEY);
    return queueJson ? JSON.parse(queueJson) : {};
  } catch (error) {
    console.error('[OfflineQueue] Erro ao buscar fila de status:', error);
    return {};
  }
};

// Enfileira atualizações de disponibilidade de drinks (on/off) na fila
export const enqueueDrinkUpdate = async (drinkId, isInactive) => {
  try {
    const queueJson = await AsyncStorage.getItem(DRINKS_UPDATE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : {};
    
    // Armazena apenas o último status do drink (se ligou e desligou, guarda a última ação)
    queue[drinkId] = isInactive;
    
    await AsyncStorage.setItem(DRINKS_UPDATE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Atualização de Drink enfileirada: ${drinkId} -> Inativo: ${isInactive}`);
  } catch (error) {
    console.error('[OfflineQueue] Erro ao enfileirar atualização de drink:', error);
  }
};

export const getDrinksUpdateQueue = async () => {
  try {
    const queueJson = await AsyncStorage.getItem(DRINKS_UPDATE_KEY);
    return queueJson ? JSON.parse(queueJson) : {};
  } catch (error) {
    console.error('[OfflineQueue] Erro ao buscar fila de drinks:', error);
    return {};
  }
};

// Modifica o status de um pedido que AINDA está na OFFLINE_QUEUE_KEY (nunca foi ao firebase)
export const updateOfflineQueueOrderStatus = async (offlineId, newStatus) => {
  try {
    const queue = await getOfflineQueue();
    const updatedQueue = queue.map(order => 
      order.offlineId === offlineId 
        ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
        : order
    );
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue));
    console.log(`[OfflineQueue] Status local atualizado para ${offlineId} -> ${newStatus}`);
  } catch (error) {
    console.error('[OfflineQueue] Erro ao atualizar offline status:', error);
  }
};

// Sincroniza a fila com o Firebase
export const syncOfflineOrders = async () => {
  if (isSyncing) {
    console.log('[OfflineQueue] Sincronização já em andamento. Ignorando chamada duplicada.');
    return;
  }
  isSyncing = true;

  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.log('[OfflineQueue] Tentativa de sync abortada - Sem internet.');
      isSyncing = false;
      return;
    }

    const queue = await getOfflineQueue();
    // Verifica primeiro a validade da fila
    const statusQueue = await getStatusUpdatesQueue();
    const drinksQueue = await getDrinksUpdateQueue();
    const orderIdsToUpdate = Object.keys(statusQueue);
    const drinkIdsToUpdate = Object.keys(drinksQueue);

    if (queue.length === 0 && orderIdsToUpdate.length === 0 && drinkIdsToUpdate.length === 0) {
      console.log('[OfflineQueue] Nenhuma pendência para sincronizar.');
      isSyncing = false;
      return;
    }

    if (queue.length > 0) {
      console.log(`[OfflineQueue] Sincronizando ${queue.length} pedidos pendentes...`);

    // Array para os pedidos que não conseguiram ser processados (se ocorrer novo erro de rede no meio)
    const pendingQueue = [];

    // Traz o catálogo de bebidas uma vez para não repetir GETs no Firebase
    const drinksSnapshot = await get(ref(db, 'drinks'));
    const drinksData = drinksSnapshot.exists() ? drinksSnapshot.val() : {};

    for (const pedido of queue) {
      try {
        const pedidoToSync = { ...pedido };
        delete pedidoToSync.isOffline;
        delete pedidoToSync.offlineId; // Firebase não precisa do offlineId
        // Firebase irá gerar seu próprio push id
        await push(ref(db, 'pedidos'), pedidoToSync);
        
        // ---- BAIXA DE ESTOQUE REMOTA PÓS-SYNC ----
        if (pedidoToSync.partyId && Object.keys(drinksData).length > 0) {
          try {
            const estoqueRef = ref(db, `festas/${pedidoToSync.partyId}/estoque`);
            const estoqueSnapshot = await get(estoqueRef);
            
            if (estoqueSnapshot.exists()) {
               const estoqueAtual = estoqueSnapshot.val();
               let hasChanges = false;
               
               for (const item of pedidoToSync.drinks || []) {
                  const realDrink = Object.values(drinksData).find(d => d.name === item.drinkName);
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
                  await set(estoqueRef, estoqueAtual);
               }
            }
          } catch (stkErr) {
             console.error(`[OfflineQueue] Falha ao dar baixa no estoque do pedido sync:`, stkErr);
          }
        }

        console.log(`[OfflineQueue] Pedido de ${pedidoToSync.nome || 'Offline'} sincronizado com sucesso.`);
      } catch (err) {
        console.error(`[OfflineQueue] Falha ao sincronizar pedido de ${pedido.nome || 'Offline'}, mantendo na fila:`, err);
        pendingQueue.push(pedido);
      }
    }

    // Estratégia Segura de Limpeza:
    // Re-lemos a fila do storage porque um pedido novo pode ter sido criado enquanto o For Loop rodava!
    const currentQueue = await getOfflineQueue();
    const originalIds = queue.map(q => q.offlineId);
    const failedIds = pendingQueue.map(p => p.offlineId);

    const safeQueue = currentQueue.filter(item => 
      failedIds.includes(item.offlineId) || !originalIds.includes(item.offlineId)
    );

    // Atualiza a fila apenas com os seguros
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(safeQueue));
    if (safeQueue.length === 0) {
      console.log('[OfflineQueue] Sincronização de criação concluída 100%.');
    } else {
      console.log(`[OfflineQueue] Sync parcial de criação. Restam ${safeQueue.length} pedidos na fila.`);
    }
    } // fecha if (queue.length > 0)

    // 2. Sincronizar atualizações de status pendentes
    if (orderIdsToUpdate.length > 0) {
      console.log(`[OfflineQueue] Sincronizando ${orderIdsToUpdate.length} updates de status pendentes...`);
      const pendingStatusQueue = { ...statusQueue };
      
      for (const orderId of orderIdsToUpdate) {
        try {
          const updates = statusQueue[orderId];
          // Prepara as chaves para update multi-path
          const updatePack = {};
          for (const key in updates) {
            updatePack[`pedidos/${orderId}/${key}`] = updates[key];
          }
          const { update } = require('firebase/database');
          await update(ref(db), updatePack);
          console.log(`[OfflineQueue] Status do pedido ${orderId} atualizado no Firebase.`);
          delete pendingStatusQueue[orderId];
        } catch (err) {
          console.error(`[OfflineQueue] Falha ao sync status de ${orderId}:`, err);
        }
      }
      
      await AsyncStorage.setItem(STATUS_QUEUE_KEY, JSON.stringify(pendingStatusQueue));
      if (Object.keys(pendingStatusQueue).length === 0) {
        console.log('[OfflineQueue] Sincronização de status concluída 100%.');
      }
    }

    // 3. Sincronizar atualizações de bebidas (corta-bebida)
    if (drinkIdsToUpdate.length > 0) {
      console.log(`[OfflineQueue] Sincronizando ${drinkIdsToUpdate.length} updates de drinks pendentes...`);
      const pendingDrinksQueue = { ...drinksQueue };
      
      try {
        const updatePack = {};
        for (const drinkId of drinkIdsToUpdate) {
          updatePack[`drinks/${drinkId}/inactive`] = drinksQueue[drinkId];
        }
        const { update } = require('firebase/database');
        await update(ref(db), updatePack);
        console.log(`[OfflineQueue] Atualizações de drinks aplicadas no Firebase.`);
        // Limpa a fila após aplicar tudo de uma vez
        await AsyncStorage.removeItem(DRINKS_UPDATE_KEY);
      } catch (err) {
        console.error(`[OfflineQueue] Falha ao sync updates de drinks:`, err);
      }
    }

  } catch (error) {
    console.error('[OfflineQueue] Erro interno durante sincronização:', error);
  } finally {
    isSyncing = false;
  }
};

// Inicia um listener global para sincronizar automaticamente quando a internet voltar
export const startNetworkListener = () => {
  console.log('[OfflineQueue] Listener de rede iniciado para Sync Automático.');
  return NetInfo.addEventListener(state => {
    if (state.isConnected) {
      syncOfflineOrders();
    }
  });
};
