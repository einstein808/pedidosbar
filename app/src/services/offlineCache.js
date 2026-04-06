import AsyncStorage from '@react-native-async-storage/async-storage';

// Chaves padronizadas do cache
export const CACHE_KEYS = {
  DRINKS: '@cached_drinks',
  FESTAS: '@cached_festas',
  PEDIDOS: '@cached_pedidos',
  CLIENTES: '@cached_clientes',
  ACTIVE_PARTY: '@cached_active_party',
  INSUMOS: '@cached_insumos',
  ESTOQUE: '@cached_estoque',
  DRINKS_CATALOG: '@cached_drinks_catalog',
  DISMISSED_ALERTS: '@cached_dismissed_alerts',
};

/**
 * Salva dados no cache local via AsyncStorage.
 * @param {string} key — Uma das CACHE_KEYS
 * @param {any} data — Objeto/array serializável
 */
export const cacheData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[OfflineCache] Erro ao salvar cache "${key}":`, error);
  }
};

/**
 * Retorna os dados cacheados, ou null/defaultValue se não existir.
 * @param {string} key
 * @param {any} defaultValue
 */
export const getCachedData = async (key, defaultValue = null) => {
  try {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : defaultValue;
  } catch (error) {
    console.error(`[OfflineCache] Erro ao ler cache "${key}":`, error);
    return defaultValue;
  }
};

/**
 * Remove uma chave do cache.
 * @param {string} key
 */
export const clearCache = async (key) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`[OfflineCache] Erro ao limpar cache "${key}":`, error);
  }
};
