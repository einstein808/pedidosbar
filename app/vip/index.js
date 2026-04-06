import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform, KeyboardAvoidingView, TextInput } from "react-native";
import { useRouter, useLocalSearchParams, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { getDatabase, ref, get, query, orderByChild, equalTo } from "firebase/database";
import { app } from "../src/config/firebaseConfig";
import { useAppStore } from "../src/store/useAppStore";
import "../../global.css";

export default function VIPAuthScreen() {
  const router = useRouter();
  
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [status, setStatus] = useState("idle"); // idle, loading, error, success
  const [errorMessage, setErrorMessage] = useState("");

  const setClientInfo = useAppStore(s => s.setClientInfo);
  const setFestaSelecionada = useAppStore(s => s.setFestaSelecionada);

  const handleValidation = () => {
    if (!codigoDigitado || codigoDigitado.trim() === "") {
      setErrorMessage("Por favor, digite o código VIP.");
      setStatus("error");
      return;
    }
    verifyMagicLink(codigoDigitado.trim().toUpperCase());
  };

  const verifyMagicLink = async (codigo) => {
    setStatus("loading");
    setErrorMessage("");
    
    try {
      const db = getDatabase(app);
      const clientesRef = ref(db, 'clientes');
      
      // Busca a raiz e faz o filtro local para bypassar o erro de .indexOn do Firebase
      const snapshot = await get(clientesRef);
      
      let clientKey = null;
      let clientData = null;

      if (snapshot.exists()) {
        const data = snapshot.val();
        // Varre todos para achar qual possui exatamente esta senha
        for (const key in data) {
          if (data[key].password === codigo) {
            clientKey = key;
            clientData = data[key];
            break;
          }
        }
      }
      
      if (clientKey && clientData) {
        
        // Setup Zustand Cache
        setClientInfo({ id: clientKey, name: clientData.name, whatsapp: clientData.whatsapp, role: 'vip' });
        
        // Ativa a Festa localmente
        if (clientData.festaId) {
          const partyRef = ref(db, `festas/${clientData.festaId}`);
          const pSnap = await get(partyRef);
          if (pSnap.exists()) {
            setFestaSelecionada({ id: clientData.festaId, ...pSnap.val() });
          }
        }
        
        setStatus("success");
        // Bypass limpo para o menu restrito
        router.replace('/pedidosBar/selecaoBebidas?partyId=' + clientData.festaId);
      } else {
        // Redundância de segurança: limpa qualquer rastro anterior
        setClientInfo({ name: '', whatsapp: '' });
        setErrorMessage("Código de acesso não encontrado ou já expirado.");
        setStatus("error");
      }
    } catch (err) {
      setClientInfo({ name: '', whatsapp: '' });
      console.log("Erro VIP:", err);
      setErrorMessage("Erro: " + (err.message || "Falha desconhecida."));
      setStatus("error");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1c1f0f', justifyContent: 'center', alignItems: 'center' }}>
      
      {status === 'loading' ? (
        <Animated.View entering={FadeInDown.duration(800)} style={{ alignItems: 'center' }}>
           <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.2)', padding: 24, borderRadius: 32, marginBottom: 24 }}>
             <ActivityIndicator size="large" color="#cc9e6f" />
           </View>
           <Text style={{ color: '#cc9e6f', fontSize: 24, fontWeight: '800', letterSpacing: 1 }}>Processando Convite</Text>
           <Text style={{ color: 'rgba(255, 255, 255, 0.6)', marginTop: 8, fontSize: 16 }}>Checando banco de dados VIP...</Text>
        </Animated.View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', paddingHorizontal: 32, alignItems: 'center' }}>
          <Animated.View entering={FadeInUp.duration(600)} style={{ width: '100%', alignItems: 'center' }}>
            <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', padding: 20, borderRadius: 28, marginBottom: 24 }}>
              <Ionicons name="key" size={48} color="#cc9e6f" />
            </View>
            <Text style={{ color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Acesso VIP</Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 15, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
              Digite o código de segurança que foi enviado pelo gerente ou anfitrião do evento.
            </Text>

            <View style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 18, marginBottom: 24, borderWidth: 1.5, borderColor: status === 'error' ? '#c83c3c' : 'rgba(204, 158, 111, 0.3)' }}>
              <TextInput
                value={codigoDigitado}
                onChangeText={(t) => {
                  setCodigoDigitado(t);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="Ex: VIP2026"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="characters"
                style={{ color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: 3, textAlign: 'center' }}
              />
            </View>

            {status === "error" && errorMessage !== "" && (
              <Animated.Text entering={FadeInDown.duration(300)} style={{ color: '#ff6b6b', fontSize: 14, fontWeight: '600', marginBottom: 24, textAlign: 'center' }}>
                {errorMessage}
              </Animated.Text>
            )}

            <TouchableOpacity 
              onPress={handleValidation}
              activeOpacity={0.8} 
              style={{ backgroundColor: '#cc9e6f', width: '100%', paddingVertical: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: '#cc9e6f', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginBottom: 24 }}
            >
              <Text style={{ color: '#1c1f0f', fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>Validar Código</Text>
              <Ionicons name="chevron-forward" size={20} color="#1c1f0f" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            <Link href="/" asChild>
              <TouchableOpacity activeOpacity={0.6}>
                <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>Voltar para o Totem Público</Text>
              </TouchableOpacity>
            </Link>

          </Animated.View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
