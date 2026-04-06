import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import * as Network from 'expo-network';
import NetInfo from '@react-native-community/netinfo';
import { startLocalServer, stopLocalServer, isServerRunning } from './src/services/localServer';
import { getBaristaIp, setBaristaIp, pingBaristaP2P } from './src/services/localClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import '../global.css';

export default function ConfigRedeScreen() {
  const router = useRouter();
  const [deviceIp, setDeviceIp] = useState('Buscando...');
  const [targetIp, setTargetIp] = useState('');
  const [isBaristaServer, setIsBaristaServer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pingStatus, setPingStatus] = useState(null); // null | 'loading' | 'ok' | 'fail'

  useEffect(() => {
    const loadState = async () => {
      try {
        const netState = await NetInfo.fetch();
        const wifiIp = netState?.details?.ipAddress;

        if (wifiIp && wifiIp !== '0.0.0.0') {
          setDeviceIp(wifiIp);
        } else {
          const fallback = await Network.getIpAddressAsync();
          setDeviceIp(fallback || 'Conecte ao Wi-Fi');
        }

        const savedTargetIp = await getBaristaIp();
        if (savedTargetIp) setTargetIp(savedTargetIp);

        const serverMode = await AsyncStorage.getItem('@barman_is_server');
        if (serverMode === 'true') {
          setIsBaristaServer(true);
          startLocalServer(8080);
        } else {
          setIsBaristaServer(false);
        }
      } catch (e) {
        setDeviceIp('Desconhecido');
      } finally {
        setLoading(false);
      }
    };
    loadState();
  }, []);

  const toggleServer = async (value) => {
    setIsBaristaServer(value);
    await AsyncStorage.setItem('@barman_is_server', value ? 'true' : 'false');

    if (value) {
      startLocalServer(8080);
      Alert.alert('Servidor Ativo ✅', `O Tablet Barista está escutando no IP: ${deviceIp}`);
    } else {
      stopLocalServer();
      Alert.alert('Servidor Pausado ⏸️', 'Recebimento de totens desligado.');
    }
  };

  const saveAndTestIp = async () => {
    const trimmedIp = targetIp.trim();
    if (!trimmedIp.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/)) {
      Alert.alert('IP Inválido', 'Digite um IP no formato correto (ex: 192.168.0.100)');
      return;
    }

    await setBaristaIp(trimmedIp);
    setPingStatus('loading');

    try {
      await pingBaristaP2P(trimmedIp);
      setPingStatus('ok');
    } catch (e) {
      console.log('[ConfigRede] Ping falhou:', e.message);
      setPingStatus('fail');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0EA' }}>
        <ActivityIndicator size="large" color="#cc9e6f" />
      </View>
    );
  }

  const pingLabel = {
    null: null,
    loading: { text: 'Testando conexão...', color: '#707b55', icon: 'sync-outline' },
    ok:      { text: 'Barista respondeu! ✅', color: '#78a764', icon: 'checkmark-circle' },
    fail:    { text: 'Sem resposta ❌  — Verifique o IP e se o Barista ativou o servidor.', color: '#c83c3c', icon: 'alert-circle' },
  }[pingStatus];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>

        {/* Header */}
        <Animated.View entering={FadeInUp.duration(400)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 24 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#c8cac6' }}>
              <Ionicons name="arrow-back" size={20} color="#1c1f0f" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center', marginRight: 42 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1c1f0f' }}>Rede P2P Offline</Text>
            </View>
          </View>
        </Animated.View>

        {/* Info Geral */}
        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
          <View style={{ backgroundColor: 'rgba(204, 158, 111, 0.1)', padding: 16, borderRadius: 16, marginBottom: 24, flexDirection: 'row', gap: 12 }}>
            <Ionicons name="information-circle" size={24} color="#cc9e6f" />
            <Text style={{ flex: 1, color: '#707b55', fontSize: 13, lineHeight: 20 }}>
              Um tablet vira a antena (Barista Mestre). Os outros se conectam informando o IP dele. Funciona sem internet!
            </Text>
          </View>
        </Animated.View>

        {/* IP Deste Aparelho */}
        <Animated.View entering={FadeInUp.duration(400).delay(200)}>
          <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: '#e8e5e1', marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: '#707b55', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 }}>Meu IP Local (Wi-Fi)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#1c1f0f' }}>{deviceIp}</Text>
              <Ionicons name="wifi" size={28} color={deviceIp === 'Desconhecido' || deviceIp === 'Buscando...' ? '#c8cac6' : '#78a764'} />
            </View>
            <Text style={{ color: '#a0a29f', fontSize: 11, marginTop: 6 }}>
              Passe este IP para o tablet Totem quando este for o Barista Mestre.
            </Text>
          </View>
        </Animated.View>

        {/* Modo Servidor (Barista) */}
        <Animated.View entering={FadeInUp.duration(400).delay(300)} layout={Layout.springify()}>
          <View style={{ backgroundColor: isBaristaServer ? '#1c1f0f' : '#FFF', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: isBaristaServer ? '#1c1f0f' : '#e8e5e1', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: isBaristaServer ? '#FFF' : '#1c1f0f' }}>Modo Barista Mestre</Text>
                <Text style={{ fontSize: 13, color: isBaristaServer ? 'rgba(255,255,255,0.7)' : '#707b55', marginTop: 4 }}>
                  Ative neste tablet para receber pedidos dos Totems via Wi-Fi local.
                </Text>
              </View>
              <Switch
                value={isBaristaServer}
                onValueChange={toggleServer}
                trackColor={{ false: '#c8cac6', true: '#cc9e6f' }}
                thumbColor={isBaristaServer ? '#FFF' : '#f4f3f4'}
              />
            </View>

            {isBaristaServer && (
              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#78a764' }} />
                <Text style={{ color: '#78a764', fontWeight: '700' }}>Antena Ativa na Porta 8080</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Modo Totem */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)} layout={Layout.springify()}>
          <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: '#e8e5e1', opacity: isBaristaServer ? 0.5 : 1 }}>
            <View pointerEvents={isBaristaServer ? 'none' : 'auto'}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1c1f0f' }}>Modo Totem de Pedidos</Text>
              <Text style={{ fontSize: 13, color: '#707b55', marginTop: 4, marginBottom: 16 }}>
                Digite o IP que aparece no tablet do Barista Mestre:
              </Text>

              {/* Input + Botão Salvar & Testar */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1, backgroundColor: '#F5F0EA', borderRadius: 12, borderWidth: 1.5, borderColor: pingStatus === 'ok' ? '#78a764' : pingStatus === 'fail' ? '#c83c3c' : '#c8cac6', paddingHorizontal: 16, height: 52, justifyContent: 'center' }}>
                  <TextInput
                    value={targetIp}
                    onChangeText={(t) => { setTargetIp(t); setPingStatus(null); }}
                    placeholder="Ex: 192.168.43.1"
                    keyboardType="numeric"
                    style={{ fontSize: 18, color: '#1c1f0f', fontWeight: '700', letterSpacing: 1 }}
                  />
                </View>
                <TouchableOpacity
                  onPress={saveAndTestIp}
                  disabled={pingStatus === 'loading'}
                  style={{ backgroundColor: pingStatus === 'ok' ? '#78a764' : '#1c1f0f', height: 52, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', opacity: pingStatus === 'loading' ? 0.7 : 1 }}
                >
                  {pingStatus === 'loading'
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Ionicons name="wifi" size={22} color="#cc9e6f" />
                  }
                </TouchableOpacity>
              </View>

              {/* Resultado do ping */}
              {pingLabel && (
                <Animated.View entering={FadeInUp.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: pingStatus === 'ok' ? 'rgba(120, 167, 100, 0.1)' : pingStatus === 'fail' ? 'rgba(200, 60, 60, 0.08)' : 'rgba(112, 123, 85, 0.08)', borderRadius: 12 }}>
                  <Ionicons name={pingLabel.icon} size={18} color={pingLabel.color} />
                  <Text style={{ color: pingLabel.color, fontSize: 13, fontWeight: '600', flex: 1 }}>{pingLabel.text}</Text>
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>

      </View>
    </SafeAreaView>
  );
}
