import { getCachedData, CACHE_KEYS } from './offlineCache';

/**
 * Reads ALL cached data from AsyncStorage in parallel.
 * Called once at app startup (in _layout.js) before any screen renders.
 * Returns a fully populated snapshot of local data.
 */
export const warmCache = async () => {
  try {
    const [drinks, orders, festas, clientes, estoque, dismissedAlerts] = await Promise.all([
      getCachedData(CACHE_KEYS.DRINKS_CATALOG, []),
      getCachedData(CACHE_KEYS.PEDIDOS, []),
      getCachedData(CACHE_KEYS.FESTAS, []),
      getCachedData(CACHE_KEYS.CLIENTES, {}),
      getCachedData(CACHE_KEYS.ESTOQUE, {}),
      getCachedData(CACHE_KEYS.DISMISSED_ALERTS, {}),
    ]);

    console.log(
      `[WarmCache] Loaded: ${drinks.length} drinks, ${orders.length} orders, ${festas.length} festas`
    );

    return { drinks, orders, festas, clientes, estoque, dismissedAlerts };
  } catch (error) {
    console.error('[WarmCache] Failed to warm cache:', error);
    return {
      drinks: [],
      orders: [],
      festas: [],
      clientes: {},
      estoque: {},
      dismissedAlerts: {},
    };
  }
};
