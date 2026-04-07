import React, { useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { app } from '../config/firebaseConfig';
import { cacheData, CACHE_KEYS } from '../services/offlineCache';
import { useNetworkStore } from '../store/useNetworkStore';

export default function WarmCache() {
  const isOffline = useNetworkStore(s => s.isOffline);

  useEffect(() => {
    if (isOffline) return; // Não tenta sincronizar com Firebase se já sabe que está offline

    const db = getDatabase(app);

    // Cache Clientes
    const clientsRef = ref(db, 'clientes');
    const unsubscribeClients = onValue(clientsRef, (snapshot) => {
      if (snapshot.exists()) {
        cacheData(CACHE_KEYS.CLIENTES, snapshot.val());
      }
    });

    // Cache Drinks
    const drinksRef = ref(db, 'drinks');
    const unsubscribeDrinks = onValue(drinksRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const catalog = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        cacheData(CACHE_KEYS.DRINKS_CATALOG, catalog);
      }
    });

    // Cache Festas
    const festasRef = ref(db, 'festas');
    const unsubscribeFestas = onValue(festasRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const activeIds = Object.keys(data).filter(key => data[key].status === 'ativa');
        cacheData(CACHE_KEYS.FESTAS, activeIds);
      }
    });

    // Cache Pedidos
    const ordersRef = ref(db, 'pedidos');
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const ordersList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        cacheData(CACHE_KEYS.PEDIDOS, ordersList);
      }
    });

    return () => {
      unsubscribeClients();
      unsubscribeDrinks();
      unsubscribeFestas();
      unsubscribeOrders();
    };
  }, [isOffline]);

  return null; // Componente invisível
}
