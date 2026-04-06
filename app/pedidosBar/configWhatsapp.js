import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { app } from '../src/config/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConfigWhatsappScreen() {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const db = getDatabase(app);
    const configRef = ref(db, 'config/whatsapp');
    const unsub = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setApiUrl(data.apiUrl || 'https://api.gabryelamaro.com/message/sendMedia/BarmanJF');
        setApiKey(data.apiKey || 'Suapikeyaqui');
      } else {
        setApiUrl('https://api.gabryelamaro.com/message/sendMedia/BarmanJF');
        setApiKey('Suapikeyaqui');
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const db = getDatabase(app);
      const configRef = ref(db, 'config/whatsapp');
      await set(configRef, {
        apiUrl: apiUrl.trim(),
        apiKey: apiKey.trim(),
      });
      Alert.alert('Sucesso', 'Configurações de WhatsApp salvas!');
    } catch (error) {
      Alert.alert('Erro', error.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#c8cac6',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  };

  const labelStyle = {
    color: '#707b55',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, marginBottom: 28 }}>
            <View style={{ backgroundColor: 'rgba(56, 168, 82, 0.15)', borderRadius: 14, padding: 10 }}>
              <Ionicons name="logo-whatsapp" size={26} color="#38a852" />
            </View>
            <Text style={{ color: '#1c1f0f', fontSize: 24, fontWeight: '800' }}>
              API WhatsApp
            </Text>
          </View>
        </Animated.View>

        {loading ? (
           <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
             <ActivityIndicator size="large" color="#78a764" />
           </View>
        ) : (
          <Animated.View entering={FadeInUp.duration(500).delay(100)}>
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 24,
                marginBottom: 20,
                borderWidth: 1.5,
                borderColor: '#c8cac6',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <Text style={{ color: '#1c1f0f', fontSize: 15, fontWeight: '500', marginBottom: 20, lineHeight: 22 }}>
                Configure a URL da API e a Chave de Autenticação (API Key) para envio de notificações aos clientes.
              </Text>

              <Text style={labelStyle}>URL da API</Text>
              <View style={inputStyle}>
                <Ionicons name="link-outline" size={20} color="#cc9e6f" style={{ marginRight: 12 }} />
                <TextInput
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="https://api..."
                  placeholderTextColor="#c8cac6"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <Text style={labelStyle}>API Key</Text>
              <View style={inputStyle}>
                <Ionicons name="key-outline" size={20} color="#cc9e6f" style={{ marginRight: 12 }} />
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Sua API Key"
                  placeholderTextColor="#c8cac6"
                  style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                onPress={saveConfig}
                disabled={saving}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#38a852',
                  paddingVertical: 18,
                  borderRadius: 16,
                  gap: 10,
                  marginTop: 8,
                  opacity: saving ? 0.7 : 1,
                  shadowColor: '#38a852',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  elevation: 5,
                }}
              >
                {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="save-outline" size={22} color="#FFF" />}
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>{saving ? 'Salvando...' : 'Salvar Configurações'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
