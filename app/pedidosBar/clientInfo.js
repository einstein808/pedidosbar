import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppStore } from "../src/store/useAppStore";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import NetInfo from "@react-native-community/netinfo";
import { cacheData, getCachedData, CACHE_KEYS } from '../src/services/offlineCache';
import { withTimeout } from '../src/utils/firebaseHelpers';
import {
  getDatabase,
  ref,
  push,
  set,
  query,
  orderByChild,
  equalTo,
  startAt,
  endAt,
  get,
} from "firebase/database";

export default function ClientInfoScreen() {
  const setClientInfo = useAppStore(s => s.setClientInfo);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [offlineClients, setOfflineClients] = useState([]);

  // Sincroniza e carrega cache de clientes para modo offline
  useEffect(() => {
    const fetchClients = async () => {
      // Começa via cache para velocidade imediata
      const cached = await getCachedData(CACHE_KEYS.CLIENTES, {});
      setOfflineClients(Object.keys(cached).map(k => ({ id: k, ...cached[k] })));

      // Sincronização passiva
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          const snap = await withTimeout(get(ref(db, 'clientes')), 8000);
          if (snap.exists()) {
            const raw = snap.val();
            cacheData(CACHE_KEYS.CLIENTES, raw);
            setOfflineClients(Object.keys(raw).map(k => ({ id: k, ...raw[k] })));
          }
        }
      } catch (e) {
        console.warn('Sync clientes offline falhou silenciado.', e);
      }
    };
    fetchClients();
  }, []);

  const router = useRouter();
  const { partyId } = useLocalSearchParams();
  const db = getDatabase();

  const formatWhatsapp = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleWhatsappChange = async (text) => {
    const formatted = formatWhatsapp(text);
    setWhatsapp(formatted);

    const digits = formatted.replace(/\D/g, '');
    
    // Auto-busca preditiva se tiver 4 dígitos ou mais
    if (digits.length >= 4) {
      try {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
          const snapWhats = await withTimeout(get(
             query(
                ref(db, "clientes"), 
                orderByChild("whatsapp"), 
                startAt(formatted), 
                endAt(formatted + "\uf8ff")
             )
          ), 3000);
          
          if (snapWhats.exists()) {
            const data = snapWhats.val();
            const results = Object.keys(data).map(k => ({ id: k, ...data[k] })).slice(0, 3);
            setSuggestions(results);
            
            // Se fechou 11 exato
            if (digits.length === 11) {
               const exactMatch = results.find(r => r.whatsapp === formatted);
               if (exactMatch) {
                 setName(exactMatch.name);
                 setSuggestions([]);
               }
            }
          } else {
             fallbackPredictive(digits);
          }
        } else {
           fallbackPredictive(digits);
        }
      } catch (e) {
         fallbackPredictive(digits);
      }
    } else {
      setSuggestions([]); // menor q 4 dígitos esconde
    }
  };

  const fallbackPredictive = (searchDigits) => {
    const matches = offlineClients.filter(c => c.whatsapp && c.whatsapp.replace(/\D/g, '').includes(searchDigits));
    if (matches.length > 0) {
      setSuggestions(matches.slice(0, 3));
      
      // Auto preenche se for 11 exatos
      if (searchDigits.length === 11) {
        const exactMatch = matches.find(r => r.whatsapp && r.whatsapp.replace(/\D/g, '') === searchDigits);
        if (exactMatch) {
           setName(exactMatch.name);
           setSuggestions([]);
        }
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSaveClient = async () => {
    if (!whatsapp) {
      Alert.alert("Erro", "Por favor, informe seu WhatsApp.");
      return;
    }
    
    // Se eles apagarem o auto-fill e tentarem ir sem nome
    if (!name && whatsapp.replace(/\D/g, '').length < 11) {
      Alert.alert("Erro", "Nome ou WhatsApp válido é obrigatório.");
      return;
    }

    const state = await NetInfo.fetch();
    const isOffline = !state.isConnected;

    let clientId = null;
    let finalName = name || "Cliente VIP";

    // 1. Tenta achar o cliente existente pelo WhatsApp para reciclar o ID
    if (!isOffline) {
       try {
         const snapWhats = await withTimeout(get(query(ref(db, "clientes"), orderByChild("whatsapp"), equalTo(whatsapp))), 3000);
         if (snapWhats.exists()) {
            const data = snapWhats.val();
            clientId = Object.keys(data)[0];
            if (!name) finalName = data[clientId].name;
         }
       } catch (e) {}
    } else {
       // Busca offline match
       const matched = offlineClients.find(c => c.whatsapp === whatsapp);
       if (matched) {
          clientId = matched.id;
          if (!name) finalName = matched.name;
       }
    }

    // 2. Se não achou, cria novo ID
    if (!clientId) {
       if (!name) {
         Alert.alert("Aviso", "Ainda não te conhecemos! Qual seu nome?");
         return;
       }
       const clientesRef = ref(db, "clientes");
       const novoClienteRef = push(clientesRef);
       clientId = novoClienteRef.key;
       
       if (!isOffline) {
          try {
             await withTimeout(set(novoClienteRef, { name: finalName, whatsapp, createdAt: new Date().toISOString() }), 3000);
          } catch(e) {}
       }
    }

    setClientInfo({ id: clientId, name: finalName, whatsapp });
    router.push(`/pedidosBar/selecaoBebidas?partyId=${partyId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Decorative */}
          <View style={{ position: 'absolute', top: 40, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(120, 167, 100, 0.08)' }} />
          <View style={{ position: 'absolute', bottom: 60, left: -20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(204, 158, 111, 0.06)' }} />

          {/* Header */}
          <Animated.View entering={FadeInUp.duration(500)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
              <View style={{ backgroundColor: '#1c1f0f', borderRadius: 18, padding: 14 }}>
                <Ionicons name="person-outline" size={26} color="#cc9e6f" />
              </View>
              <View>
                <Text style={{ color: '#1c1f0f', fontSize: 26, fontWeight: '800' }}>
                  Identificação
                </Text>
                <Text style={{ color: '#707b55', fontSize: 14, marginTop: 2 }}>
                  Preencha para receber notificações
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Card do formulário único */}
          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 22,
              padding: 24,
              marginBottom: 32,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}>
              {/* Título seção */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                <Ionicons name="logo-whatsapp" size={20} color="#78a764" />
                <Text style={{ color: '#1c1f0f', fontSize: 17, fontWeight: '700' }}>Seu Contato</Text>
              </View>

              {/* Campo WhatsApp */}
              <Text style={{
                color: '#707b55',
                fontSize: 14,
                fontWeight: '700',
                marginBottom: 10,
                marginLeft: 4,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                1. Número (DDD)
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F5F0EA',
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 18,
                marginBottom: 24,
                borderWidth: 1.5,
                borderColor: '#e8e4de',
              }}>
                <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.15)', borderRadius: 12, padding: 10, marginRight: 14 }}>
                  <Ionicons name="call-outline" size={22} color="#78a764" />
                </View>
                <TextInput
                  value={whatsapp}
                  onChangeText={handleWhatsappChange}
                  placeholder="(00) 00000-0000"
                  placeholderTextColor="#c8cac6"
                  keyboardType="phone-pad"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }}
                />
              </View>

              {suggestions.length > 0 && (
                <Animated.View entering={FadeInUp.duration(300)}>
                  <View style={{ backgroundColor: '#fff', borderRadius: 16, marginTop: -16, marginBottom: 24, paddingHorizontal: 12, borderWidth: 1.5, borderColor: '#e8e4de', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, zIndex: 10 }}>
                    {suggestions.map((sug) => (
                      <TouchableOpacity 
                        key={sug.id} 
                        onPress={() => {
                          setWhatsapp(sug.whatsapp);
                          setName(sug.name);
                          setSuggestions([]);
                        }}
                        style={{ paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: '#F5F0EA', flexDirection: 'row', alignItems: 'center' }}
                      >
                        <View style={{ backgroundColor: 'rgba(120, 167, 100, 0.12)', borderRadius: 10, padding: 8, marginRight: 12 }}>
                          <Ionicons name="time-outline" size={18} color="#78a764" />
                        </View>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1c1f0f' }}>{sug.whatsapp}</Text>
                          <Text style={{ fontSize: 13, color: '#707b55', marginTop: 2 }}>{sug.name}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    
                    {/* Botão de Auto Cadastro explícito */}
                    <TouchableOpacity 
                      onPress={() => {
                        setSuggestions([]);
                        if (!name) setName(""); 
                      }}
                      style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
                    >
                      <View style={{ backgroundColor: 'rgba(28, 31, 15, 0.08)', borderRadius: 10, padding: 8, marginRight: 12 }}>
                        <Ionicons name="person-add-outline" size={18} color="#1c1f0f" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1c1f0f' }}>Ainda não sou cadastrado</Text>
                        <Text style={{ fontSize: 13, color: '#707b55', marginTop: 2 }}>Preencha seu nome abaixo para criar</Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color="#c8cac6" />
                    </TouchableOpacity>

                  </View>
                </Animated.View>
              )}

              {/* Campo Nome */}
              <Text style={{
                color: '#707b55',
                fontSize: 14,
                fontWeight: '700',
                marginBottom: 10,
                marginLeft: 4,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                2. Nome para Retirada
              </Text>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F5F0EA',
                borderRadius: 16,
                paddingHorizontal: 18,
                paddingVertical: 18,
                borderWidth: 1.5,
                borderColor: '#e8e4de',
              }}>
                <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.15)', borderRadius: 12, padding: 10, marginRight: 14 }}>
                  <Ionicons name="person-outline" size={22} color="#cc9e6f" />
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Como devemos te chamar?"
                  placeholderTextColor="#c8cac6"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 18, fontWeight: '600' }}
                  autoCapitalize="words"
                />
              </View>
              
              {/* Micro-Copy Explicativo Simplificado */}
              <Text style={{ color: '#a0a29f', fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18, paddingHorizontal: 10 }}>
                Dica: Digite seu número primeiro. Se você já pediu antes, vamos preencher o nome sozinhos!
              </Text>

            </View>
          </Animated.View>

          {/* Botão Salvar */}
          <Animated.View entering={FadeInUp.duration(500).delay(200)}>
            <TouchableOpacity
              onPress={handleSaveClient}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1c1f0f',
                paddingVertical: 20,
                borderRadius: 18,
                gap: 10,
                shadowColor: '#1c1f0f',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 14,
                elevation: 8,
              }}
            >
              <Text style={{ color: '#cc9e6f', fontWeight: '800', fontSize: 18 }}>
                Continuar
              </Text>
              <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.2)', borderRadius: 10, padding: 6 }}>
                <Ionicons name="arrow-forward" size={20} color="#cc9e6f" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
               onPress={() => router.push('/')}
               style={{ marginTop: 20, alignItems: 'center' }}
               activeOpacity={0.6}
            >
               <Text style={{ color: '#707b55', fontWeight: 'bold', textDecorationLine: 'underline' }}>Voltar ao Início</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
