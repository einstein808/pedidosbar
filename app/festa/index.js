// app/festa.js
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { db } from "../src/config/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { useAppStore } from "../src/store/useAppStore";
import { useRouter } from "expo-router";
import OfflineBanner from '../src/components/atoms/OfflineBanner';
import { useNetworkStore } from '../src/store/useNetworkStore';
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EscolherFesta() {
  const [festas, setFestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const setFestaSelecionada = useAppStore(s => s.setFestaSelecionada);
  const router = useRouter();
  const isOffline = useNetworkStore(s => s.isOffline);

  useEffect(() => {
    const loadCache = async () => {
      const cached = await getCachedData(CACHE_KEYS.FESTAS, []);
      if (cached && cached.length > 0) {
        setFestas(cached);
        setLoading(false);
      }
    };
    loadCache();

    const festasRef = ref(db, "festas");
    const unsubscribe = onValue(festasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.entries(data).map(([id, festa]) => ({
          ...festa,
          uid: festa.uid ?? id, // Garante que o uid exista
        }));

        setFestas(lista);
        cacheData(CACHE_KEYS.FESTAS, lista);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const selecionarFesta = (festa) => {
    setFestaSelecionada(festa);
    router.back();
  };

  if (loading) return <ActivityIndicator size="large" color="#000" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <OfflineBanner />
      <View className="p-4">
        <Text className="text-xl font-bold mb-4">Escolha uma Festa</Text>
        {isOffline && (
          <Text className="text-sm text-gray-500 italic mb-4">
            Modo offline ativo. Exibindo dados em cache. Modificações estão desabilitadas.
          </Text>
        )}
        <FlatList
          data={festas}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => selecionarFesta(item)}
              className="bg-blue-100 p-4 rounded-xl mb-2"
              disabled={isOffline && false} // Só leitura não impede seleção, a menos que se queira bloquear
            >
              <Text className="text-lg font-semibold text-gray-900">{item.nome}</Text>
              <Text className="text-gray-600">{item.data}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
