import { View, Text, TextInput, Alert } from "react-native";
import { useState, useEffect } from "react";
import { useAuthStore } from "../src/store/useAuthStore";
import Button from "../src/components/atoms/buttom";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";
import "../../global.css";

export default function Login() {
  const loginCliente = useAuthStore(s => s.loginCliente);
  const loginBarista = useAuthStore(s => s.loginBarista);
  const user = useAuthStore(s => s.user);
  const isLoading = useAuthStore(s => s.isLoading);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Auto-redirecionamento se já logado
  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'barista') {
        router.replace('/home');
      } else {
        router.replace('/pedidosBar');
      }
    }
  }, [user, isLoading]);

  const handleCliente = async () => {
    await loginCliente();
    router.replace('/pedidosBar');
  };

  const handleBarista = async () => {
    const success = await loginBarista(username, password);
    if (success) {
      router.replace('/home');
    } else {
      Alert.alert('Erro', 'Usuário ou senha incorretos');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32 }}>

        {/* Decorative circles */}
        <View style={{ position: 'absolute', top: 60, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(120, 167, 100, 0.12)' }} />
        <View style={{ position: 'absolute', bottom: 100, left: -20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(204, 158, 111, 0.1)' }} />

        {/* Logo */}
        <Animated.View entering={FadeInUp.duration(500)} style={{ alignItems: 'center', marginBottom: 36 }}>
          <View
            style={{
              backgroundColor: '#1c1f0f',
              borderRadius: 24,
              padding: 20,
              marginBottom: 18,
              shadowColor: '#1c1f0f',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Ionicons name="wine" size={40} color="#cc9e6f" />
          </View>
          <Text style={{ color: '#1c1f0f', fontSize: 26, fontWeight: '700', textAlign: 'center' }}>
            Portal do Barista
          </Text>
          <Text style={{ color: '#707b55', fontSize: 14, marginTop: 6, textAlign: 'center' }}>
            Faça login para gerenciar seus pedidos
          </Text>
        </Animated.View>

        {/* Campo Usuário */}
        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            Usuário
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 16,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Ionicons name="person-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Digite seu usuário"
              placeholderTextColor="#c8cac6"
              value={username}
              onChangeText={setUsername}
              style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
              autoCapitalize="none"
            />
          </View>
        </Animated.View>

        {/* Campo Senha */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)}>
          <Text style={{ color: '#707b55', fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            Senha
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 28,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <Ionicons name="lock-closed-outline" size={18} color="#cc9e6f" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Digite sua senha"
              placeholderTextColor="#c8cac6"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={{ flex: 1, color: '#1c1f0f', fontSize: 15 }}
            />
          </View>
        </Animated.View>

        {/* Botão Barista */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)}>
          <Button onPress={handleBarista} className="w-full rounded-2xl">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1c1f0f',
                borderRadius: 16,
                paddingVertical: 18,
                gap: 8,
                shadowColor: '#1c1f0f',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name="log-in-outline" size={20} color="#cc9e6f" />
              <Text style={{ color: '#cc9e6f', fontWeight: '700', fontSize: 16 }}>
                Entrar como Barista
              </Text>
            </View>
          </Button>
        </Animated.View>

        {/* Separador */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#c8cac6' }} />
            <Text style={{ color: '#707b55', fontSize: 13, marginHorizontal: 16, fontWeight: '500' }}>
              ou
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#c8cac6' }} />
          </View>
        </Animated.View>

        {/* Botão Cliente */}
        <Animated.View entering={FadeInUp.duration(500).delay(500)}>
          <Button onPress={handleCliente} className="w-full rounded-2xl">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#78a764',
                borderRadius: 16,
                paddingVertical: 18,
                gap: 8,
                shadowColor: '#78a764',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name="people-outline" size={20} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                Entrar como Cliente
              </Text>
            </View>
          </Button>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
