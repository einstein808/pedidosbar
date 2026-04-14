import { create } from 'zustand';

/**
 * Boot store — session-only (no persist).
 * Holds cached data loaded from AsyncStorage at app startup by warmCacheService.
 * Provides instant data before Firebase listeners resolve.
 */
export const useBootStore = create((set) => ({
  isBooting: true,
  cachedDrinks: [],
  cachedOrders: [],
  cachedFestas: [],
  cachedClientes: {},
  cachedEstoque: {},
  cachedDismissedAlerts: {},

  hydrate: (data) =>
    set({
      cachedDrinks: data.drinks ?? [],
      cachedOrders: data.orders ?? [],
      cachedFestas: data.festas ?? [],
      cachedClientes: data.clientes ?? {},
      cachedEstoque: data.estoque ?? {},
      cachedDismissedAlerts: data.dismissedAlerts ?? {},
    }),

  setBooting: (val) => set({ isBooting: val }),
}));
