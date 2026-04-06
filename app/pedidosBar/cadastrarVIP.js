import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import { getDatabase, ref, push, set, onValue } from "firebase/database";
import { app } from "../src/config/firebaseConfig";
import "../../global.css";

export default function CadastrarVIP() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [activeParty, setActiveParty] = useState(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    const db = getDatabase(app);
    // Buscar a festa ativa
    const partiesRef = ref(db, 'festas');
    const unsubscribe = onValue(partiesRef, (snapshot) => {
      const parties = snapshot.val();
      if (parties) {
        const activeKey = Object.keys(parties).find(k => parties[k].status === 'ativa');
        if (activeKey) {
          setActiveParty({ id: activeKey, ...parties[activeKey] });
        } else {
          setActiveParty(null);
        }
      }
    });

    // Buscar API do Whatsapp
    const configRef = ref(db, 'config/whatsapp');
    const unsubscribeConfig = onValue(configRef, (snapshot) => {
      setWhatsappConfig(snapshot.val());
    });

    return () => {
      unsubscribe();
      unsubscribeConfig();
    };
  }, []);

  const formatWhatsapp = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleCreateVIP = async () => {
    if (!name || !whatsapp || !password) {
      Alert.alert("Campos Obrigatórios", "Preencha nome, whatsapp e a senha.");
      return;
    }
    if (!activeParty) {
      Alert.alert("Erro", "Não há nenhuma festa ativa no momento.");
      return;
    }

    try {
      const db = getDatabase(app);
      const clientesRef = ref(db, "clientes");
      const novoClienteRef = push(clientesRef);
      
      const clientData = {
        name,
        whatsapp,
        password, // usado como master password do cliente
        festaId: activeParty.id,
        createdAt: new Date().toISOString(),
        role: "vip"
      };

      await set(novoClienteRef, clientData);

      // Construção da Mensagem e Envio Direto
      const siteUrl = baseUrl.trim() !== "" ? baseUrl.trim() : "http://localhost:8081";
      const cleanHost = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
      const msg = `Olá *${name}*! Seu acesso VIP está liberado para o bar hoje.\n\nAcesse nosso portal VIP:\n🔗 ${cleanHost}/vip\n\nDigite seu código secreto:\n🔑 *${password}*\n\nBom evento! 🥂`;
      const num = whatsapp.replace(/\D/g, '');

      if (whatsappConfig?.apiUrl && whatsappConfig?.apiKey) {
        setIsSending(true);
        try {
          await fetch(whatsappConfig.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': whatsappConfig.apiKey },
            body: JSON.stringify({ number: "55" + num, text: msg })
          });
          Alert.alert("Sucesso!", "Cliente cadastrado e mensagem enviada automaticamente via API!");
          limparFormulario();
        } catch (e) {
          Alert.alert("Aviso", "Cliente salvo, mas falha de API ao enviar mensagem automaticamente.");
        } finally {
          setIsSending(false);
        }
      } else {
        const url = `whatsapp://send?text=${encodeURIComponent(msg)}&phone=55${num}`;
        Linking.canOpenURL(url)
          .then(supported => {
            if (!supported) {
              Alert.alert("Sucesso Parcial", "Cliente salvo, mas o envio parou porque o WhatsApp App não está instalado neste dispositivo.");
            } else {
              Linking.openURL(url);
              limparFormulario();
            }
          })
          .catch(err => {
             Alert.alert("Aviso", "Cliente salvo, mas o sistema impediu o direcionamento de link externo.");
          });
      }

    } catch (err) {
      Alert.alert("Erro", "Não foi possível cadastrar o cliente. " + err.message);
    }
  };

  const limparFormulario = () => {
    setName("");
    setWhatsapp("");
    setPassword("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#FFFFFF', padding: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#e8e4de' }}>
              <Ionicons name="arrow-back" size={24} color="#707b55" />
            </TouchableOpacity>
          </View>

          <Animated.View entering={FadeInUp.duration(500)}>
            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '800' }}>Convidar VIP</Text>
              <Text style={{ color: '#707b55', fontSize: 15, marginTop: 4 }}>
                Gere um acesso direto ao cardápio
              </Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: activeParty ? 'rgba(120, 167, 100, 0.15)' : 'rgba(200, 60, 60, 0.1)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, alignSelf: 'flex-start' }}>
                 <Ionicons name={activeParty ? "sparkles" : "warning"} size={16} color={activeParty ? "#78a764" : "#c83c3c"} />
                 <Text style={{ marginLeft: 6, color: activeParty ? '#78a764' : '#c83c3c', fontWeight: '700' }}>
                   {activeParty ? `Festa Ativa: ${activeParty.nome}` : `Nenhuma festa ativa`}
                 </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: '#c8cac6', elevation: 3, marginBottom: 24 }}>
              
              <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>URL do Site Mágico (Opcional)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EA', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1.5, borderColor: '#e8e4de' }}>
                <Ionicons name="link" size={20} color="#78a764" style={{ marginRight: 12 }} />
                <TextInput
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  placeholder="Ex: https://meubar.com"
                  placeholderTextColor="#c8cac6"
                  keyboardType="url"
                  autoCapitalize="none"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 15, fontWeight: '500' }}
                />
              </View>

              <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Nome do Cliente</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EA', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1.5, borderColor: '#e8e4de' }}>
                <Ionicons name="person" size={20} color="#cc9e6f" style={{ marginRight: 12 }} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ex: João Silva"
                  placeholderTextColor="#c8cac6"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 17, fontWeight: '500' }}
                />
              </View>

              <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>WhatsApp (+55)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EA', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20, borderWidth: 1.5, borderColor: '#e8e4de' }}>
                <Ionicons name="logo-whatsapp" size={20} color="#78a764" style={{ marginRight: 12 }} />
                <TextInput
                  value={whatsapp}
                  onChangeText={(t) => setWhatsapp(formatWhatsapp(t))}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor="#c8cac6"
                  keyboardType="number-pad"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 17, fontWeight: '500' }}
                />
              </View>

              <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Código de Acesso Exclusivo (Senha)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F0EA', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#e8e4de' }}>
                <Ionicons name="key" size={20} color="#cc9e6f" style={{ marginRight: 12 }} />
                <TextInput
                  value={password}
                  onChangeText={(text) => setPassword(text.toUpperCase().replace(/\s/g, ''))}
                  placeholder="Ex: VIPJOAO25"
                  placeholderTextColor="#c8cac6"
                  autoCapitalize="characters"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 17, fontWeight: '700', letterSpacing: 1 }}
                />
              </View>
              <Text style={{ color: '#c8cac6', fontSize: 12, marginLeft: 4, marginBottom: 20 }}>Este código será a "senha mágica" lida pela URL.</Text>

              <TouchableOpacity onPress={handleCreateVIP} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1c1f0f', paddingVertical: 18, borderRadius: 16, gap: 10 }}>
                <Text style={{ color: '#cc9e6f', fontWeight: '800', fontSize: 16 }}>
                   Criar VIP e Enviar WhatsApp
                </Text>
                <Ionicons name="send" size={18} color="#cc9e6f" />
              </TouchableOpacity>

            </View>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
