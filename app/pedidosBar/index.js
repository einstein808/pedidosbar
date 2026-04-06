import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { useAppStore } from '../src/store/useAppStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import "../../global.css";
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';

export default function PedidosRedirect() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const selectParty = useAppStore(s => s.setFestaSelecionada);
  const isOffline = useNetworkStore(s => s.isOffline);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fetchActiveParty = async () => {
      // Se estiver offline, tenta carregar festa cacheada
      if (isOffline) {
        const cached = await getCachedData(CACHE_KEYS.ACTIVE_PARTY);
        if (cached && isMounted) {
          selectParty(cached);

          if (mode === 'guest') {
            useAppStore.getState().setClientInfo({ 
              id: 'guest-' + Date.now().toString().slice(-6), 
              name: 'Modo Visitante', 
              whatsapp: '00000000000' 
            });
            router.replace('/pedidosBar/selecaoBebidas?partyId=' + cached.id);
            return;
          }

          router.replace('/pedidosBar/clientInfo');
          return;
        }
        if (isMounted) {
          setErrorMsg('Sem internet. Nenhuma festa salva no cache.');
        }
        return;
      }

      try {
        const db = getDatabase(app);
        const partiesRef = ref(db, 'festas');
        const snapshot = await get(partiesRef);
        
        if (snapshot.exists()) {
          const parties = snapshot.val();
          const activePartyKey = Object.keys(parties).find(k => parties[k].status === 'ativa');
          
          if (activePartyKey && isMounted) {
            const activeParty = { id: activePartyKey, ...parties[activePartyKey] };
            selectParty(activeParty);
            // Salva no cache para acesso offline
            await cacheData(CACHE_KEYS.ACTIVE_PARTY, activeParty);

            // Verifica se clicou no botão de Convidado Sem Cadastro
            if (mode === 'guest') {
              useAppStore.getState().setClientInfo({ 
                id: 'guest-' + Date.now().toString().slice(-6), 
                name: 'Modo Visitante', 
                whatsapp: '00000000000' 
              });
              router.replace('/pedidosBar/selecaoBebidas?partyId=' + activePartyKey);
              return;
            }
            
            const currentClient = useAppStore.getState().clientInfo;
            if (currentClient && currentClient.whatsapp && currentClient.whatsapp.length > 5) {
              router.replace('/pedidosBar/selecaoBebidas?partyId=' + activePartyKey);
            } else {
              router.replace('/pedidosBar/clientInfo?partyId=' + activePartyKey);
            }
            return;
          }
        }
        
        if (isMounted) router.replace('/pedidosBar/selectFesta');
      } catch (err) {
        // Se der erro de rede, tenta o cache
        const cached = await getCachedData(CACHE_KEYS.ACTIVE_PARTY);
        if (cached && isMounted) {
          selectParty(cached);

          if (mode === 'guest') {
            useAppStore.getState().setClientInfo({ 
              id: 'guest-' + Date.now().toString().slice(-6), 
              name: 'Modo Visitante', 
              whatsapp: '00000000000' 
            });
            router.replace('/pedidosBar/selecaoBebidas?partyId=' + cached.id);
            return;
          }

          const currentClient = useAppStore.getState().clientInfo;
          if (currentClient && currentClient.whatsapp && currentClient.whatsapp.length > 5) {
             router.replace('/pedidosBar/selecaoBebidas?partyId=' + cached.id);
          } else {
             router.replace('/pedidosBar/clientInfo?partyId=' + cached.id);
          }
          return;
        }
        if (isMounted) setErrorMsg('Erro ao buscar festa: ' + err.message);
      }
    };
    
    fetchActiveParty();
    return () => { isMounted = false; };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA', justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center' }}>
        <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.15)', borderRadius: 24, padding: 18, marginBottom: 16 }}>
           <Ionicons name="sparkles" size={32} color="#cc9e6f" />
        </View>
        <Text style={{ color: '#1c1f0f', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          {isOffline ? 'Modo Offline...' : 'Preparando Cardápio...'}
        </Text>
        <Text style={{ color: '#707b55', fontSize: 14 }}>
          {errorMsg || (isOffline ? 'Buscando dados do cache local.' : 'Acesso à fila do bar em andamento.')}
        </Text>
      </Animated.View>
    </SafeAreaView>
  );
}