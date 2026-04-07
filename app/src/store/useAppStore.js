import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAppStore = create(
  persist(
    (set) => ({
      // Festa Central (Substitui festaSelecionada do festaContext e party do orderContext)
      festaSelecionada: null,
      isPartyLoaded: false,
      setFestaSelecionada: (festa) => set({ festaSelecionada: festa }),
      setIsPartyLoaded: (status) => set({ isPartyLoaded: status }),
      
      // Informações do cliente
      clientInfo: { name: '', whatsapp: '' },
      setClientInfo: (info) => set({ clientInfo: info }),
      
      // Pedidos locais criados pela UI (Substitui pedidos do pedidoContext)
      pedidosGlobais: [],
      adicionarPedidoGlobal: (pedido) => set((state) => ({ 
        pedidosGlobais: [...state.pedidosGlobais, pedido] 
      })),
      atualizarPedidoGlobal: (pedidoAtualizado) => set((state) => ({
        pedidosGlobais: state.pedidosGlobais.map(p => 
          p.id === pedidoAtualizado.id ? pedidoAtualizado : p
        )
      })),
      alterarStatusPedidoGlobal: (pedidoId, novoStatus) => set((state) => ({
        pedidosGlobais: state.pedidosGlobais.map(p => 
          p.id === pedidoId ? { ...p, status: novoStatus } : p
        )
      })),
      
      // Configurações do Totem
      screensaverEnabled: true,
      setScreensaverEnabled: (val) => set({ screensaverEnabled: val }),

      // Carrinho de drinks local
      selectedDrinks: [],
      setSelectedDrinks: (drinks) => set({ selectedDrinks: drinks })
    }),
    {
      name: '@barman_app_state',
      storage: createJSONStorage(() => AsyncStorage),
      // Salvar festa, infos de cliente, screensaver e carrinho de drinks
      partialize: (state) => ({ 
        festaSelecionada: state.festaSelecionada,
        clientInfo: state.clientInfo,
        screensaverEnabled: state.screensaverEnabled,
        selectedDrinks: state.selectedDrinks,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setIsPartyLoaded(true);
        }
      },
    }
  )
);
