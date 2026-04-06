import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import "../../global.css";

export default function HomeDrinks() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0EA' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>

        {/* Decorative circles */}
        <View style={{ position: 'absolute', top: 50, right: -10, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(120, 167, 100, 0.1)' }} />
        <View style={{ position: 'absolute', bottom: 100, left: -20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(204, 158, 111, 0.08)' }} />

        {/* Ícone */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <View
            style={{
              backgroundColor: '#1c1f0f',
              borderRadius: 28,
              padding: 24,
              marginBottom: 28,
              shadowColor: '#1c1f0f',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Ionicons name="wine" size={48} color="#cc9e6f" />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(100)}>
          <Text style={{ color: '#1c1f0f', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            Gerenciar Drinks
          </Text>
          <Text style={{ color: '#707b55', fontSize: 15, textAlign: 'center', marginBottom: 40, lineHeight: 22 }}>
            Cadastre novos drinks ou edite os existentes
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={{ width: '100%', gap: 14 }}>
          {/* Cadastrar */}
          <TouchableOpacity
            onPress={() => router.push('/drinks/cadastrar')}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#78a764',
              borderRadius: 16,
              paddingVertical: 18,
              gap: 10,
              shadowColor: '#78a764',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Cadastrar Novo Drink</Text>
          </TouchableOpacity>

          {/* Editar */}
          <TouchableOpacity
            onPress={() => router.push('/drinks/editar')}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              paddingVertical: 18,
              borderWidth: 1.5,
              borderColor: '#c8cac6',
              gap: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <Ionicons name="settings-outline" size={20} color="#707b55" />
            <Text style={{ color: '#1c1f0f', fontWeight: '600', fontSize: 16 }}>Gerenciar Drinks</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Voltar */}
        <Animated.View entering={FadeInUp.duration(500).delay(300)} style={{ marginTop: 40 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16 }}
          >
            <Ionicons name="arrow-back" size={16} color="#707b55" />
            <Text style={{ color: '#707b55', fontSize: 14, fontWeight: '500' }}>Voltar</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
