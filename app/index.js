import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Pressable, Platform, ActivityIndicator } from "react-native";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { useState, useRef, useCallback } from "react";
import "../global.css";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useAppStore } from './src/store/useAppStore';

export default function Home() {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  
  const screensaverEnabled = useAppStore(s => s.screensaverEnabled);
  const setScreensaverEnabled = useAppStore(s => s.setScreensaverEnabled);
  
  const router = useRouter();
  
  // Timer de inatividade (15 segundos)
  const IDLE_TIME = 15000;
  const idleTimer = useRef(null);

  const resetTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (screensaverEnabled) {
      idleTimer.current = setTimeout(() => {
        router.push('/pedidosBar/ultimosPedidos');
      }, IDLE_TIME);
    }
  }, [screensaverEnabled, router]);

  // Reseta o timer sempre que a tela ganha foco ou as prefs mudam
  useFocusEffect(
    useCallback(() => {
      resetTimer();
      return () => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
      };
    }, [resetTimer])
  );

  // Senha master temporária configurada no plano
  const MASTER_PASSWORD = "123";

  const handleAdminAccess = () => {
    if (adminPassword === MASTER_PASSWORD) {
      setShowAdminModal(false);
      setAdminPassword("");
      // Roteamos para o painel de login de barista
      router.push("/login");
    } else {
      Alert.alert("Acesso Negado", "Senha administrativa incorreta.");
      setAdminPassword("");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-barsand" onTouchStart={resetTimer}>
      
      {/* Botão Superior Direito - Habilitar/Desabilitar Screensaver */}
      <View className="absolute top-12 right-6 z-50">
        <TouchableOpacity 
          onPress={() => setScreensaverEnabled(!screensaverEnabled)}
          activeOpacity={0.7}
          className="bg-white/50 p-3 rounded-full border border-bargold/30 flex-row items-center gap-2 shadow-sm"
        >
          <Ionicons 
            name={screensaverEnabled ? "tv" : "tv-outline"} 
            size={20} 
            color={screensaverEnabled ? "#78a764" : "#c8cac6"}
          />
          <Text style={{ color: screensaverEnabled ? "#78a764" : "#c8cac6", fontSize: 12, fontWeight: '700' }}>
            AUTO {screensaverEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 justify-center items-center px-8">

        {/* Decorative circles */}
        <View className="absolute top-10 -right-5 w-24 h-24 rounded-full bg-bargreen/15" />
        <View className="absolute top-32 -left-8 w-16 h-16 rounded-full bg-bargold/15" />
        <View className="absolute bottom-20 right-8 w-12 h-12 rounded-full bg-barolive/10" />

        {/* Logo (Com Toque Longo Secreto) */}
        <Animated.View entering={FadeInUp.duration(600)} className="items-center mb-12 z-10 mt-8">
          <Pressable 
            onPress={() => {}} 
            onLongPress={() => setShowAdminModal(true)} 
            delayLongPress={1500}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View className="items-center">
              <View 
                className="bg-bardark rounded-3xl p-6 mb-6 shadow-xl shadow-bardark/30"
                style={{ elevation: 8 }}
              >
                <Ionicons name="beer" size={48} color="#cc9e6f" />
              </View>
              <Text className="text-bardark text-[28px] font-extrabold text-center tracking-tight">
                Laboratório de Drinks
              </Text>
              <Text className="text-bargold text-lg mt-1 font-bold text-center">
                @laboratoriodedrink
              </Text>
            </View>
          </Pressable>
          <Text className="text-barolive text-[15px] mt-3 text-center leading-[22px] max-w-[260px]">
            Bem-vindo! Realize o seu pedido utilizando o nosso autoatendimento.
          </Text>
        </Animated.View>

        {/* Botões do Cliente (3 opções) */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)} className="w-full gap-4 z-10 pb-8">
          
          {/* Opção 1: Convidado Sem Cadastro */}
          <TouchableOpacity activeOpacity={0.8} className="w-full" onPress={() => router.push('/pedidosBar?mode=guest')}>
            <View 
              className="flex-row items-center bg-[#F5F0EA] rounded-[20px] p-5 gap-4 shadow-xl border-2 border-bargold/30"
              style={{ elevation: 4 }}
            >
              <View className="bg-barolive/10 rounded-2xl p-4">
                <Ionicons name="person-circle-outline" size={32} color="#78a764" />
              </View>
              <View className="flex-1">
                <Text className="text-bardark font-extrabold text-[18px] tracking-tight">
                  Convidado s/ Cadastro
                </Text>
                <Text className="text-barolive text-[13px] mt-1 font-medium leading-tight">
                  Pode fazer pedido sem buscar nome ou whatsapp (retire no balcão).
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#78a764" />
            </View>
          </TouchableOpacity>

          {/* Opção 2: Cadastrado */}
          <TouchableOpacity activeOpacity={0.8} className="w-full" onPress={() => {
            // Limpa dados de sessões anteriores para forçar busca do cliente no totem
            import('../app/src/store/useAppStore').then(module => {
               module.useAppStore.getState().setClientInfo({ name: '', whatsapp: '' });
               router.push('/pedidosBar');
            }).catch(() => router.push('/pedidosBar'));
          }}>
            <View 
              className="flex-row items-center bg-[#1c1f0f] rounded-[20px] p-5 gap-4 shadow-xl shadow-bardark/40"
              style={{ elevation: 8 }}
            >
              <View className="bg-bargold/15 rounded-2xl p-4">
                <Ionicons name="logo-whatsapp" size={32} color="#cc9e6f" />
              </View>
              <View className="flex-1">
                <Text className="text-bargold font-extrabold text-[18px] tracking-tight">
                  Sou Cadastrado
                </Text>
                <Text className="text-bargold/80 text-[13px] mt-1 font-medium leading-tight">
                  Busca seu nome ou WhatsApp. Você será avisado no celular quando estiver pronto.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#cc9e6f" />
            </View>
          </TouchableOpacity>

          {/* Opção 3: Cliente VIP */}
          <TouchableOpacity activeOpacity={0.8} className="w-full" onPress={() => router.push('/vip')}>
            <View 
              className="flex-row items-center bg-[#F5F0EA] rounded-[20px] p-5 gap-4 shadow-xl border-2 border-bardark/10"
              style={{ elevation: 2 }}
            >
              <View className="bg-bardark/5 rounded-2xl p-4">
                <Ionicons name="star" size={32} color="#d4a017" />
              </View>
              <View className="flex-1">
                <Text className="text-bardark font-extrabold text-[18px] tracking-tight">
                  Cliente VIP
                </Text>
                <Text className="text-barolive text-[13px] mt-1 font-medium leading-tight">
                  Pedir via WhatsApp sem filas! Utilize o código do camarote para acessar.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#1c1f0f" />
            </View>
          </TouchableOpacity>

        </Animated.View>
      </View>

      {/* Modal Admin Secreto */}
      <Modal visible={showAdminModal} transparent animationType="fade" onRequestClose={() => setShowAdminModal(false)}>
         <View style={{ flex: 1, backgroundColor: 'rgba(28, 31, 15, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#F5F0EA', borderRadius: 24, padding: 32, width: '100%', maxWidth: 360, alignItems: 'center' }}>
               <View style={{ backgroundColor: '#1c1f0f', borderRadius: 20, padding: 16, marginBottom: 20 }}>
                  <Ionicons name="lock-closed" size={32} color="#cc9e6f" />
               </View>
               <Text style={{ color: '#1c1f0f', fontSize: 22, fontWeight: '800', marginBottom: 8 }}>Acesso Gestor</Text>
               <Text style={{ color: '#707b55', fontSize: 14, textAlign: 'center', marginBottom: 24 }}>Digite o PIN de acesso à área da equipe.</Text>
               
               <TextInput
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry
                  placeholder="****"
                  placeholderTextColor="#c8cac6"
                  keyboardType="numeric"
                  style={{
                     backgroundColor: '#FFFFFF',
                     width: '100%',
                     borderRadius: 16,
                     borderWidth: 2,
                     borderColor: '#e8e4de',
                     padding: 16,
                     fontSize: 24,
                     textAlign: 'center',
                     fontWeight: '700',
                     color: '#1c1f0f',
                     marginBottom: 24
                  }}
               />

               <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
                  <TouchableOpacity 
                     onPress={() => setShowAdminModal(false)}
                     style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: 'rgba(28, 31, 15, 0.05)', alignItems: 'center' }}
                  >
                     <Text style={{ color: '#707b55', fontWeight: '700', fontSize: 16 }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                     onPress={handleAdminAccess}
                     style={{ flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#1c1f0f', alignItems: 'center' }}
                  >
                     <Text style={{ color: '#cc9e6f', fontWeight: '800', fontSize: 16 }}>Entrar</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}
