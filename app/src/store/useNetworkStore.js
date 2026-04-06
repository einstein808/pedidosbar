import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { syncOfflineOrders, getOfflineQueue } from '../services/offlineQueue';

export const useNetworkStore = create((set, get) => ({
  isOffline: false,
  offlineQueueCount: 0,
  isListening: false,
  
  updateQueueCount: async () => {
    try {
        // Usa require inline para evitar erros circulares caso offlineQueue não esteja pronto no import
      const { getOfflineQueue } = require('../services/offlineQueue');
      const queue = await getOfflineQueue();
      set({ offlineQueueCount: queue.length });
    } catch (e) {
      console.error('[useNetworkStore] Erro ao ler fila offline:', e);
    }
  },
  
  setIsOffline: (status) => set({ isOffline: status }),
  
  initNetworkListener: () => {
    if (get().isListening) return; // evita instanciar múltiplos listeners
    
    set({ isListening: true });
    
    // Assinar a mudança de rede
    NetInfo.addEventListener(state => {
      const offline = !state.isConnected;
      get().setIsOffline(offline);

      if (!offline) {
        // Reconectou
        const { syncOfflineOrders } = require('../services/offlineQueue');
        syncOfflineOrders().then(() => get().updateQueueCount());
      } else {
        get().updateQueueCount();
      }
    });

    get().updateQueueCount();
    
    // Polling da fila a cada 5 segundos se estiver offline
    setInterval(() => {
      if (get().isOffline) {
        get().updateQueueCount();
      }
    }, 5000);
  }
}));
